from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.models.project import Project
from app.db.models.slack_delivery import SlackDelivery
from app.slack.types import SUPPORTED_SLACK_TYPES

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SlackSendResult:
    status: str
    slack_delivery_id: str | None = None
    provider_message_id: str | None = None
    reason: str | None = None


def send_slack_if_not_sent(
    db: Session,
    *,
    user_id: str | UUID,
    project_id: str | UUID,
    notification_type: str,
    dedupe_key: str,
    message_text: str,
) -> SlackSendResult:
    if notification_type not in SUPPORTED_SLACK_TYPES:
        raise ValueError(f"Unsupported Slack notification type: {notification_type}")
    if not dedupe_key:
        raise ValueError("dedupe_key is required")
    if not message_text:
        raise ValueError("message_text is required")

    normalized_user_id = _normalize_uuid(user_id, field_name="user_id")
    normalized_project_id = _normalize_uuid(project_id, field_name="project_id")

    existing = db.query(SlackDelivery).filter(SlackDelivery.dedupe_key == dedupe_key).first()
    if existing is not None:
        if existing.status in {"queued", "failed"}:
            return _send_existing_delivery(
                db=db,
                delivery=existing,
                message_text=message_text,
            )
        return SlackSendResult(
            status="skipped_dedup",
            slack_delivery_id=str(existing.id),
            provider_message_id=existing.provider_message_id,
            reason="duplicate_dedupe_key",
        )

    project = db.query(Project).filter(Project.id == normalized_project_id).first()
    if project is None:
        raise ValueError("Project not found for Slack send")

    suppression_reason = _suppression_reason(project=project)
    if suppression_reason:
        suppressed = SlackDelivery(
            user_id=normalized_user_id,
            project_id=normalized_project_id,
            notification_type=notification_type,
            dedupe_key=dedupe_key,
            status="suppressed",
            payload_json={"reason": suppression_reason},
            created_at=datetime.now(timezone.utc),
        )
        db.add(suppressed)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.query(SlackDelivery).filter(SlackDelivery.dedupe_key == dedupe_key).first()
            return SlackSendResult(
                status="skipped_dedup",
                slack_delivery_id=str(existing.id) if existing else None,
                reason="duplicate_dedupe_key",
            )
        return SlackSendResult(
            status="suppressed",
            slack_delivery_id=str(suppressed.id),
            reason=suppression_reason,
        )

    delivery = SlackDelivery(
        user_id=normalized_user_id,
        project_id=normalized_project_id,
        notification_type=notification_type,
        dedupe_key=dedupe_key,
        status="queued",
        payload_json={"message_text": message_text},
        created_at=datetime.now(timezone.utc),
    )
    db.add(delivery)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(SlackDelivery).filter(SlackDelivery.dedupe_key == dedupe_key).first()
        return SlackSendResult(
            status="skipped_dedup",
            slack_delivery_id=str(existing.id) if existing else None,
            reason="duplicate_dedupe_key",
        )

    return _send_existing_delivery(
        db=db,
        delivery=delivery,
        message_text=message_text,
    )


def _suppression_reason(project: Project) -> str | None:
    if not settings.SLACK_ENABLED:
        return "rollout_disabled"
    if project.plan != "pro":
        return "plan_not_eligible"
    if not project.slack_enabled:
        return "integration_disabled"
    if not project.slack_webhook_url:
        return "missing_webhook_url"
    return None


def _send_existing_delivery(
    db: Session,
    *,
    delivery: SlackDelivery,
    message_text: str,
) -> SlackSendResult:
    db.refresh(delivery)
    project = db.query(Project).filter(Project.id == delivery.project_id).first()
    if project is None:
        raise ValueError("Project not found for Slack delivery retry")

    suppression_reason = _suppression_reason(project=project)
    if suppression_reason:
        delivery.status = "suppressed"
        delivery.error_message = None
        delivery.payload_json = {"reason": suppression_reason}
        db.commit()
        return SlackSendResult(
            status="suppressed",
            slack_delivery_id=str(delivery.id),
            reason=suppression_reason,
        )

    delivery.status = "queued"
    delivery.error_message = None
    delivery.payload_json = {
        "message_text": message_text,
        "channel": project.slack_channel,
    }
    db.commit()

    try:
        provider_message_id = _send_slack_webhook(
            webhook_url=project.slack_webhook_url or "",
            message_text=message_text,
            channel=project.slack_channel,
        )
    except Exception as exc:
        db.refresh(delivery)
        delivery.status = "failed"
        delivery.error_message = str(exc)
        db.commit()
        logger.warning(
            "slack_send_failed",
            slack_delivery_id=str(delivery.id),
            project_id=str(delivery.project_id),
            error=str(exc),
        )
        return SlackSendResult(
            status="failed",
            slack_delivery_id=str(delivery.id),
            reason=str(exc),
        )

    db.refresh(delivery)
    delivery.status = "sent"
    delivery.provider_message_id = provider_message_id
    delivery.sent_at = datetime.now(timezone.utc)
    delivery.error_message = None
    db.commit()

    logger.info(
        "slack_sent",
        slack_delivery_id=str(delivery.id),
        project_id=str(delivery.project_id),
        provider_message_id=provider_message_id,
    )
    return SlackSendResult(
        status="sent",
        slack_delivery_id=str(delivery.id),
        provider_message_id=provider_message_id,
    )


def _send_slack_webhook(*, webhook_url: str, message_text: str, channel: str | None = None) -> str:
    payload: dict[str, Any] = {"text": message_text}
    if channel:
        payload["channel"] = channel

    timeout = float(max(1, int(getattr(settings, "SLACK_HTTP_TIMEOUT_SECONDS", 10) or 10)))
    with httpx.Client(timeout=timeout) as client:
        response = client.post(webhook_url, json=payload)
        response.raise_for_status()
        body = response.text.strip().lower()
        if body and body not in {"ok", "accepted"}:
            raise RuntimeError(f"Slack webhook returned unexpected body: {response.text}")

    return f"slack_webhook:{int(datetime.now(timezone.utc).timestamp())}"


def _normalize_uuid(value: str | UUID, *, field_name: str) -> UUID:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception as exc:  # pragma: no cover
        raise ValueError(f"Invalid {field_name}") from exc

