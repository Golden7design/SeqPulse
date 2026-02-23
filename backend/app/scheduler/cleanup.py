from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy.orm import Session

from app.db.models.scheduled_job import ScheduledJob

logger = structlog.get_logger(__name__)

_HMAC_ERROR_MARKERS = (
    "HMAC validation failed",
    "MetricsHMACValidationError",
)
_CLEANUP_JOB_TYPES = {"pre_collect", "post_collect", "analysis"}
_CLEANUP_PENDING_STATUSES = {"pending", "running"}
_CLEANUP_REASON = "Cancelled by cleanup after HMAC validation failures on this deployment"


def cleanup_hmac_jobs_for_deployment(
    db: Session,
    *,
    deployment_id: UUID,
    dry_run: bool = False,
) -> dict:
    jobs = (
        db.query(ScheduledJob)
        .filter(ScheduledJob.deployment_id == deployment_id)
        .order_by(ScheduledJob.created_at.asc())
        .all()
    )

    has_hmac_failure = any(_is_hmac_failure(job.last_error) for job in jobs)

    cleanup_candidates = [
        job
        for job in jobs
        if job.job_type in _CLEANUP_JOB_TYPES and job.status in _CLEANUP_PENDING_STATUSES
    ]

    if not has_hmac_failure or dry_run:
        return {
            "deployment_id": str(deployment_id),
            "has_hmac_failure": has_hmac_failure,
            "cleaned_jobs": len(cleanup_candidates) if has_hmac_failure else 0,
            "dry_run": dry_run,
        }

    now = datetime.now(timezone.utc)
    cleaned_jobs = 0
    for job in cleanup_candidates:
        job.status = "failed"
        job.last_error = _CLEANUP_REASON
        job.updated_at = now
        cleaned_jobs += 1

    db.commit()
    logger.info(
        "hmac_jobs_cleanup_completed",
        deployment_id=str(deployment_id),
        cleaned_jobs=cleaned_jobs,
    )

    return {
        "deployment_id": str(deployment_id),
        "has_hmac_failure": has_hmac_failure,
        "cleaned_jobs": cleaned_jobs,
        "dry_run": dry_run,
    }


def _is_hmac_failure(last_error: str | None) -> bool:
    if not last_error:
        return False
    return any(marker in last_error for marker in _HMAC_ERROR_MARKERS)

