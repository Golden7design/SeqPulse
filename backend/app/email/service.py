from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urljoin
from uuid import UUID, uuid4

import httpx
import structlog
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.models.email_delivery import EmailDelivery
from app.email.templates import render_mvp_email_content
from app.email.types import (
    EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
    SUPPORTED_MVP_EMAIL_TYPES,
    is_marketing_email,
)

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class EmailSendResult:
    status: str
    email_delivery_id: str | None = None
    provider_message_id: str | None = None
    reason: str | None = None


def build_frontend_url(path: str) -> str:
    base_url = (settings.FRONTEND_URL or "http://localhost:3000").strip().rstrip("/") + "/"
    normalized_path = (path or "/").lstrip("/")
    return urljoin(base_url, normalized_path)


def send_email_if_not_sent(
    db: Session,
    *,
    user_id: str | UUID,
    to_email: str,
    email_type: str,
    dedupe_key: str,
    project_id: str | UUID | None = None,
    context: dict[str, Any] | None = None,
) -> EmailSendResult:
    if email_type not in SUPPORTED_MVP_EMAIL_TYPES:
        raise ValueError(f"Unsupported MVP email type: {email_type}")
    if not dedupe_key:
        raise ValueError("dedupe_key is required")
    if not to_email:
        raise ValueError("to_email is required")

    normalized_user_id = _normalize_uuid(user_id, field_name="user_id")
    normalized_project_id = _normalize_uuid(project_id, field_name="project_id") if project_id else None

    existing = db.query(EmailDelivery).filter(EmailDelivery.dedupe_key == dedupe_key).first()
    if existing is not None:
        if existing.status in {"queued", "failed"}:
            if not _is_email_type_enabled(email_type):
                db.refresh(existing)
                existing.status = "suppressed"
                existing.error_message = None
                existing.payload_json = {"reason": "rollout_disabled"}
                db.commit()
                return EmailSendResult(
                    status="suppressed",
                    email_delivery_id=str(existing.id),
                    reason="rollout_disabled",
                )
            return _send_existing_delivery(
                db=db,
                delivery=existing,
                to_email=to_email,
                email_type=email_type,
                dedupe_key=dedupe_key,
                context=context or {},
            )
        return EmailSendResult(
            status="skipped_dedup",
            email_delivery_id=str(existing.id),
            provider_message_id=existing.provider_message_id,
            reason="duplicate_dedupe_key",
        )

    now = datetime.now(timezone.utc)
    if not _is_email_type_enabled(email_type):
        suppressed = EmailDelivery(
            user_id=normalized_user_id,
            project_id=normalized_project_id,
            email_type=email_type,
            dedupe_key=dedupe_key,
            status="suppressed",
            payload_json={"reason": "rollout_disabled"},
            created_at=now,
        )
        db.add(suppressed)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.query(EmailDelivery).filter(EmailDelivery.dedupe_key == dedupe_key).first()
            return EmailSendResult(
                status="skipped_dedup",
                email_delivery_id=str(existing.id) if existing else None,
                reason="duplicate_dedupe_key",
            )
        return EmailSendResult(
            status="suppressed",
            email_delivery_id=str(suppressed.id),
            reason="rollout_disabled",
        )

    if _should_skip_no_project_email(db=db, user_id=normalized_user_id, email_type=email_type):
        suppressed = EmailDelivery(
            user_id=normalized_user_id,
            project_id=normalized_project_id,
            email_type=email_type,
            dedupe_key=dedupe_key,
            status="suppressed",
            payload_json={"reason": "project_already_created"},
            created_at=now,
        )
        db.add(suppressed)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.query(EmailDelivery).filter(EmailDelivery.dedupe_key == dedupe_key).first()
            return EmailSendResult(
                status="skipped_dedup",
                email_delivery_id=str(existing.id) if existing else None,
                reason="duplicate_dedupe_key",
            )
        return EmailSendResult(
            status="suppressed",
            email_delivery_id=str(suppressed.id),
            reason="project_already_created",
        )

    if _is_marketing_throttled(db=db, user_id=normalized_user_id, email_type=email_type, now=now):
        suppressed = EmailDelivery(
            user_id=normalized_user_id,
            project_id=normalized_project_id,
            email_type=email_type,
            dedupe_key=dedupe_key,
            status="suppressed",
            payload_json={"reason": "marketing_cooldown"},
            created_at=now,
        )
        db.add(suppressed)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.query(EmailDelivery).filter(EmailDelivery.dedupe_key == dedupe_key).first()
            return EmailSendResult(
                status="skipped_dedup",
                email_delivery_id=str(existing.id) if existing else None,
                reason="duplicate_dedupe_key",
            )
        return EmailSendResult(
            status="suppressed",
            email_delivery_id=str(suppressed.id),
            reason="marketing_cooldown",
        )

    delivery = EmailDelivery(
        user_id=normalized_user_id,
        project_id=normalized_project_id,
        email_type=email_type,
        dedupe_key=dedupe_key,
        status="queued",
        payload_json={},
        created_at=now,
    )
    db.add(delivery)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(EmailDelivery).filter(EmailDelivery.dedupe_key == dedupe_key).first()
        return EmailSendResult(
            status="skipped_dedup",
            email_delivery_id=str(existing.id) if existing else None,
            reason="duplicate_dedupe_key",
        )

    return _send_existing_delivery(
        db=db,
        delivery=delivery,
        to_email=to_email,
        email_type=email_type,
        dedupe_key=dedupe_key,
        context=context or {},
    )


def _is_marketing_throttled(db: Session, user_id: UUID, email_type: str, now: datetime) -> bool:
    if not is_marketing_email(email_type):
        return False

    cooldown_hours = max(1, int(getattr(settings, "EMAIL_MARKETING_COOLDOWN_HOURS", 24) or 24))
    window_start = now - timedelta(hours=cooldown_hours)

    recent_marketing_count = (
        db.query(EmailDelivery)
        .filter(
            EmailDelivery.user_id == user_id,
            EmailDelivery.email_type.in_(list(filter(is_marketing_email, SUPPORTED_MVP_EMAIL_TYPES))),
            EmailDelivery.status == "sent",
            EmailDelivery.sent_at.isnot(None),
            EmailDelivery.sent_at >= window_start,
        )
        .count()
    )
    return recent_marketing_count > 0


def _is_email_type_enabled(email_type: str) -> bool:
    configured = (getattr(settings, "EMAIL_ENABLED_TYPES", "") or "").strip()
    if not configured:
        return True

    enabled_types = {
        token.strip().upper()
        for token in configured.split(",")
        if token and token.strip()
    }
    enabled_supported = enabled_types.intersection(SUPPORTED_MVP_EMAIL_TYPES)
    return email_type in enabled_supported


def _should_skip_no_project_email(db: Session, user_id: UUID, email_type: str) -> bool:
    if email_type != EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP:
        return False

    row = db.execute(
        text("SELECT 1 FROM projects WHERE owner_id = :owner_id LIMIT 1"),
        {"owner_id": str(user_id)},
    ).first()
    return row is not None


def _send_existing_delivery(
    db: Session,
    *,
    delivery: EmailDelivery,
    to_email: str,
    email_type: str,
    dedupe_key: str,
    context: dict[str, Any],
) -> EmailSendResult:
    enriched_context = _enrich_context(context)
    content = render_mvp_email_content(email_type=email_type, context=enriched_context)

    db.refresh(delivery)
    delivery.status = "queued"
    delivery.error_message = None
    delivery.payload_json = {
        "to_email": to_email,
        "subject": content.subject,
        "context": enriched_context,
    }
    db.commit()

    try:
        provider_message_id = _send_via_provider(
            to_email=to_email,
            subject=content.subject,
            text=content.text,
            html=content.html,
            dedupe_key=dedupe_key,
        )
    except Exception as exc:
        db.refresh(delivery)
        delivery.status = "failed"
        delivery.error_message = str(exc)
        db.commit()
        logger.warning(
            "email_send_failed",
            email_type=email_type,
            dedupe_key=dedupe_key,
            user_id=str(delivery.user_id),
            project_id=str(delivery.project_id) if delivery.project_id else None,
            error=str(exc),
        )
        return EmailSendResult(
            status="failed",
            email_delivery_id=str(delivery.id),
            reason=str(exc),
        )

    db.refresh(delivery)
    delivery.status = "sent"
    delivery.provider_message_id = provider_message_id
    delivery.sent_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(
        "email_sent",
        email_type=email_type,
        dedupe_key=dedupe_key,
        email_delivery_id=str(delivery.id),
        provider_message_id=provider_message_id,
        user_id=str(delivery.user_id),
        project_id=str(delivery.project_id) if delivery.project_id else None,
    )
    return EmailSendResult(
        status="sent",
        email_delivery_id=str(delivery.id),
        provider_message_id=provider_message_id,
    )


def _normalize_uuid(value: str | UUID, *, field_name: str) -> UUID:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception as exc:
        raise ValueError(f"{field_name} must be a valid UUID") from exc


def _enrich_context(context: dict[str, Any]) -> dict[str, Any]:
    payload = dict(context)
    payload.setdefault("dashboard_url", build_frontend_url(settings.EMAIL_CTA_DASHBOARD_PATH))
    payload.setdefault("pricing_url", build_frontend_url(settings.EMAIL_CTA_PRICING_PATH))
    payload.setdefault("onboarding_url", build_frontend_url(settings.EMAIL_CTA_ONBOARDING_PATH))
    return payload


def _send_via_provider(*, to_email: str, subject: str, text: str, html: str, dedupe_key: str) -> str:
    provider = (settings.EMAIL_PROVIDER or "console").strip().lower()
    if provider == "resend":
        return _send_via_resend(
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            dedupe_key=dedupe_key,
        )
    if provider == "postmark":
        return _send_via_postmark(
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            dedupe_key=dedupe_key,
        )
    if provider in {"console", "noop"}:
        msg_id = f"{provider}_{uuid4()}"
        logger.info(
            "email_send_mocked",
            provider=provider,
            to_email=to_email,
            subject=subject,
            provider_message_id=msg_id,
        )
        return msg_id
    raise ValueError(f"Unsupported email provider: {provider}")


def _send_via_resend(*, to_email: str, subject: str, text: str, html: str, dedupe_key: str) -> str:
    api_key = (settings.EMAIL_API_KEY or "").strip()
    if not api_key:
        raise ValueError("EMAIL_API_KEY is required for resend provider")

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "text": text,
        "html": html,
    }
    reply_to = (settings.EMAIL_REPLY_TO or "").strip()
    if reply_to:
        payload["reply_to"] = reply_to

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": dedupe_key,
        },
        json=payload,
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    msg_id = data.get("id")
    if not msg_id:
        raise ValueError("Resend response missing message id")
    return str(msg_id)


def _send_via_postmark(*, to_email: str, subject: str, text: str, html: str, dedupe_key: str) -> str:
    api_key = (settings.EMAIL_API_KEY or "").strip()
    if not api_key:
        raise ValueError("EMAIL_API_KEY is required for postmark provider")

    payload = {
        "From": settings.EMAIL_FROM,
        "To": to_email,
        "Subject": subject,
        "TextBody": text,
        "HtmlBody": html,
        "Metadata": {"dedupe_key": dedupe_key},
    }
    reply_to = (settings.EMAIL_REPLY_TO or "").strip()
    if reply_to:
        payload["ReplyTo"] = reply_to

    response = httpx.post(
        "https://api.postmarkapp.com/email",
        headers={
            "X-Postmark-Server-Token": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json=payload,
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    msg_id = data.get("MessageID")
    if not msg_id:
        raise ValueError("Postmark response missing MessageID")
    return str(msg_id)
