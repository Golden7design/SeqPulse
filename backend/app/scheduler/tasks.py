# app/scheduler/tasks.py
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy.orm import Session

from app.db.models.scheduled_job import ScheduledJob

logger = structlog.get_logger(__name__)

POST_COLLECTION_INTERVAL_SECONDS = 60  # seconds


def _build_job_metadata(
    metrics_endpoint: str,
    use_hmac: bool,
    hmac_secret: str,
    project_id: UUID,
) -> dict:
    return {
        "metrics_endpoint": metrics_endpoint,
        "use_hmac": use_hmac,
        "hmac_secret": hmac_secret,
        "project_id": str(project_id) if project_id else None,
    }


def schedule_pre_collection(
    db: Session,
    deployment_id: UUID,
    metrics_endpoint: str,
    use_hmac: bool,
    hmac_secret: str,
    project_id: UUID,
):
    job = ScheduledJob(
        deployment_id=deployment_id,
        job_type="pre_collect",
        phase="pre",
        scheduled_at=datetime.now(timezone.utc),
        status="pending",
        job_metadata=_build_job_metadata(
            metrics_endpoint=metrics_endpoint,
            use_hmac=use_hmac,
            hmac_secret=hmac_secret,
            project_id=project_id,
        ),
    )
    db.add(job)
    db.commit()

    logger.info(
        "pre_collect_job_scheduled",
        job_id=str(job.id),
        deployment_id=str(deployment_id),
        metrics_endpoint=metrics_endpoint,
        use_hmac=bool(use_hmac),
    )


def schedule_post_collection(
    db: Session,
    deployment_id: UUID,
    metrics_endpoint: str,
    use_hmac: bool,
    hmac_secret: str,
    project_id: UUID,
    observation_window: int = 5,
):
    now = datetime.now(timezone.utc)
    metadata = _build_job_metadata(
        metrics_endpoint=metrics_endpoint,
        use_hmac=use_hmac,
        hmac_secret=hmac_secret,
        project_id=project_id,
    )

    jobs = []
    for index in range(observation_window):
        jobs.append(
            ScheduledJob(
                deployment_id=deployment_id,
                job_type="post_collect",
                phase="post",
                sequence_index=index,
                scheduled_at=now + timedelta(seconds=index * POST_COLLECTION_INTERVAL_SECONDS),
                status="pending",
                job_metadata=metadata,
            )
        )

    db.add_all(jobs)
    db.commit()

    logger.info(
        "post_collect_jobs_scheduled",
        deployment_id=str(deployment_id),
        jobs_count=len(jobs),
        metrics_endpoint=metrics_endpoint,
        use_hmac=bool(use_hmac),
        observation_window=observation_window,
    )


def schedule_analysis(db: Session, deployment_id: UUID, delay_minutes: int):
    scheduled_at = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)

    job = ScheduledJob(
        deployment_id=deployment_id,
        job_type="analysis",
        phase=None,
        scheduled_at=scheduled_at,
        status="pending",
    )

    db.add(job)
    db.commit()

    logger.info(
        "analysis_job_scheduled",
        job_id=str(job.id),
        deployment_id=str(deployment_id),
        scheduled_at=scheduled_at.isoformat(),
        delay_minutes=delay_minutes,
    )
