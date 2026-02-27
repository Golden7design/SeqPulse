# app/projects/endpoint_lock.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional
from urllib.parse import urlparse

import structlog
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.project import Project
from app.db.models.project_endpoint_event import ProjectEndpointEvent
from app.metrics.collector import MetricsHMACValidationError, probe_metrics_endpoint_hmac

logger = structlog.get_logger(__name__)

EndpointMutation = Literal["none", "path_change", "host_migration"]

_VALID_STATES = {"pending_verification", "active", "blocked"}
_PLAN_CHANGE_LIMITS: dict[str, Optional[int]] = {
    "free": 1,
    "pro": 3,
    "enterprise": None,
}


def normalize_endpoint_or_raise(endpoint: str) -> str:
    raw = (endpoint or "").strip()
    parsed = urlparse(raw)

    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower()
    if scheme not in {"http", "https"} or not host:
        raise HTTPException(status_code=400, detail="ENDPOINT_INVALID_FORMAT")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="ENDPOINT_INVALID_FORMAT")

    path = _canonicalize_path(parsed.path)
    host_for_url = f"[{host}]" if ":" in host else host
    return f"{scheme}://{host_for_url}{path}"


def normalize_host(endpoint: str) -> str:
    normalized = normalize_endpoint_or_raise(endpoint)
    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    if not host:
        raise HTTPException(status_code=400, detail="ENDPOINT_INVALID_FORMAT")
    return host


def mask_endpoint(endpoint: Optional[str]) -> Optional[str]:
    if not endpoint:
        return None

    try:
        normalized = normalize_endpoint_or_raise(endpoint)
    except HTTPException:
        return None

    parsed = urlparse(normalized)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        masked_path = "/"
    elif len(segments) <= 2:
        masked_path = "/" + "/".join(segments)
    else:
        masked_path = "/" + "/".join(segments[:2]) + "/..."

    host = parsed.hostname or ""
    host_display = f"[{host}]" if ":" in host else host
    return f"{parsed.scheme}://{host_display}{masked_path}"


def detect_endpoint_mutation(project: Project, candidate_endpoint: str) -> EndpointMutation:
    candidate = normalize_endpoint_or_raise(candidate_endpoint)
    active = (getattr(project, "metrics_endpoint_active", None) or "").strip()
    if not active:
        return "none"

    active_normalized = normalize_endpoint_or_raise(active)
    if candidate == active_normalized:
        return "none"

    candidate_host = normalize_host(candidate)
    host_lock = (getattr(project, "endpoint_host_lock", None) or "").strip()
    if not host_lock:
        host_lock = normalize_host(active_normalized)

    if candidate_host != host_lock:
        return "host_migration"
    return "path_change"


def get_endpoint_limits_for_plan(plan: str) -> Optional[int]:
    return _PLAN_CHANGE_LIMITS.get((plan or "").strip().lower(), 1)


def build_project_endpoint_view(project: Project) -> dict[str, Any]:
    limit = get_endpoint_limits_for_plan(getattr(project, "plan", "free"))
    state = (getattr(project, "endpoint_state", None) or "pending_verification").strip()
    if state not in _VALID_STATES:
        state = "pending_verification"

    return {
        "state": state,
        "candidate_endpoint": getattr(project, "metrics_endpoint_candidate", None),
        "active_endpoint": getattr(project, "metrics_endpoint_active", None),
        "candidate_endpoint_masked": mask_endpoint(getattr(project, "metrics_endpoint_candidate", None)),
        "active_endpoint_masked": mask_endpoint(getattr(project, "metrics_endpoint_active", None)),
        "host_lock": getattr(project, "endpoint_host_lock", None),
        "changes_used": int(getattr(project, "endpoint_change_count", 0) or 0),
        "changes_limit": limit,
        "migrations_used": int(getattr(project, "endpoint_migration_count", 0) or 0),
        "migrations_limit": limit,
        "last_verified_at": getattr(project, "endpoint_last_verified_at", None),
        "last_test_error_code": getattr(project, "endpoint_last_test_error_code", None),
        "baseline_version": int(getattr(project, "baseline_version", 1) or 1),
    }


def update_project_endpoint_candidate(
    *,
    db: Session,
    project: Project,
    endpoint: str,
    actor_user_id,
) -> Project:
    _ensure_not_blocked(project)
    candidate = normalize_endpoint_or_raise(endpoint)
    mutation = detect_endpoint_mutation(project, candidate)
    _assert_quota(project, mutation)

    project.metrics_endpoint_candidate = candidate
    project.endpoint_state = "pending_verification"
    project.endpoint_last_test_error_code = None

    append_project_endpoint_event(
        db=db,
        project=project,
        event_type="endpoint_candidate_updated",
        actor_user_id=actor_user_id,
        payload={
            "mutation": mutation,
            "candidate_host": normalize_host(candidate),
        },
    )
    db.commit()
    db.refresh(project)
    return project


def test_and_activate_project_endpoint_candidate(
    *,
    db: Session,
    project: Project,
    actor_user_id,
) -> Project:
    _ensure_not_blocked(project)
    candidate_raw = (getattr(project, "metrics_endpoint_candidate", None) or "").strip()
    if not candidate_raw:
        raise HTTPException(status_code=400, detail="ENDPOINT_INVALID_FORMAT")

    candidate = normalize_endpoint_or_raise(candidate_raw)
    mutation = detect_endpoint_mutation(project, candidate)
    _assert_quota(project, mutation)

    try:
        probe_metrics_endpoint_hmac(
            metrics_endpoint=candidate,
            use_hmac=bool(getattr(project, "hmac_enabled", False)),
            secret=getattr(project, "hmac_secret", None),
            project_id=str(project.id),
            phase="project_endpoint_test",
            timeout_seconds=2.5,
        )
    except (MetricsHMACValidationError, ValueError) as exc:
        project.endpoint_state = "pending_verification"
        project.endpoint_last_test_error_code = "ENDPOINT_TEST_FAILED"
        append_project_endpoint_event(
            db=db,
            project=project,
            event_type="endpoint_test_failed",
            actor_user_id=actor_user_id,
            payload={
                "candidate_host": normalize_host(candidate),
                "error": str(exc),
            },
        )
        db.commit()
        db.refresh(project)
        raise HTTPException(status_code=400, detail="ENDPOINT_TEST_FAILED")

    previous_active = (getattr(project, "metrics_endpoint_active", None) or "").strip() or None
    candidate_host = normalize_host(candidate)

    project.metrics_endpoint_active = candidate
    project.endpoint_state = "active"
    project.endpoint_last_verified_at = datetime.now(timezone.utc)
    project.endpoint_last_test_error_code = None

    if not (getattr(project, "endpoint_host_lock", None) or "").strip():
        project.endpoint_host_lock = candidate_host
    elif mutation == "host_migration":
        project.endpoint_host_lock = candidate_host

    if mutation == "path_change":
        project.endpoint_change_count = int(getattr(project, "endpoint_change_count", 0) or 0) + 1
    elif mutation == "host_migration":
        project.endpoint_migration_count = int(getattr(project, "endpoint_migration_count", 0) or 0) + 1

    if previous_active and candidate != previous_active:
        project.baseline_version = int(getattr(project, "baseline_version", 1) or 1) + 1

    append_project_endpoint_event(
        db=db,
        project=project,
        event_type="endpoint_test_succeeded",
        actor_user_id=actor_user_id,
        payload={
            "candidate_host": candidate_host,
            "mutation": mutation,
        },
    )
    append_project_endpoint_event(
        db=db,
        project=project,
        event_type="endpoint_activated",
        actor_user_id=actor_user_id,
        payload={
            "active_host": candidate_host,
            "mutation": mutation,
        },
    )
    db.commit()
    db.refresh(project)
    return project


def resolve_active_endpoint_for_deployment(
    *,
    project: Project,
    payload_endpoint: Optional[str],
) -> str:
    active = (getattr(project, "metrics_endpoint_active", None) or "").strip()
    if not active:
        raise HTTPException(status_code=423, detail="PROJECT_ENDPOINT_BLOCKED")

    active_normalized = normalize_endpoint_or_raise(active)
    if payload_endpoint:
        payload_normalized = normalize_endpoint_or_raise(payload_endpoint)
        if payload_normalized != active_normalized:
            raise HTTPException(status_code=409, detail="ENDPOINT_MISMATCH")
    return active_normalized


def append_project_endpoint_event(
    *,
    db: Session,
    project: Project,
    event_type: str,
    actor_user_id=None,
    payload: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        ProjectEndpointEvent(
            project_id=project.id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            event_payload=payload,
        )
    )


def _canonicalize_path(path: str) -> str:
    if not path:
        return "/"
    if not path.startswith("/"):
        path = f"/{path}"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return path


def _ensure_not_blocked(project: Project) -> None:
    state = (getattr(project, "endpoint_state", None) or "pending_verification").strip()
    if state == "blocked":
        raise HTTPException(status_code=423, detail="PROJECT_ENDPOINT_BLOCKED")


def _assert_quota(project: Project, mutation: EndpointMutation) -> None:
    limit = get_endpoint_limits_for_plan(getattr(project, "plan", "free"))
    if limit is None:
        return

    if mutation == "path_change":
        used = int(getattr(project, "endpoint_change_count", 0) or 0)
        if used >= limit:
            raise HTTPException(status_code=409, detail="CHANGE_LIMIT_EXCEEDED")
    elif mutation == "host_migration":
        used = int(getattr(project, "endpoint_migration_count", 0) or 0)
        if used >= limit:
            raise HTTPException(status_code=409, detail="MIGRATION_LIMIT_EXCEEDED")
