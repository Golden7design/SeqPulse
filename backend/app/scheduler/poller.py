# app/scheduler/poller.py
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.db.session import SessionLocal
from app.db.models.scheduled_job import ScheduledJob
from app.metrics.collector import collect_metrics
from app.analysis.engine import analyze_deployment

logger = logging.getLogger(__name__)

POLL_INTERVAL = 10  # seconds
MAX_CONCURRENT_JOBS = 5
RUNNING_STUCK_SECONDS = 10 * 60  # 10 minutes
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [30, 120, 300]  # retry #1, #2, #3


class JobPoller:
    def __init__(self):
        self.running = False
        self.task: Optional[asyncio.Task] = None

    async def start(self):
        self.running = True
        self.task = asyncio.create_task(self._poll_forever())
        logger.info("job_poller_started")

    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("job_poller_stopped")

    async def _poll_forever(self):
        while self.running:
            try:
                await asyncio.to_thread(self._process_pending_jobs)
            except Exception as e:
                logger.exception("poller_loop_error error=%s", str(e))
            await asyncio.sleep(POLL_INTERVAL)

    def _process_pending_jobs(self):
        db = SessionLocal()
        try:
            self._recover_stuck_jobs(db)

            # Sélectionner les jobs pending qui sont dûs
            now = datetime.now(timezone.utc)
            jobs = db.query(ScheduledJob).filter(
                ScheduledJob.status == 'pending',
                ScheduledJob.scheduled_at <= now
            ).order_by(ScheduledJob.scheduled_at).limit(MAX_CONCURRENT_JOBS).all()

            if not jobs:
                return

            logger.info("processing_jobs count=%s", len(jobs))

            for job in jobs:
                self._execute_job(db, job)

        except Exception as e:
            logger.exception("poller_error error=%s", str(e))
        finally:
            db.close()

    def _recover_stuck_jobs(self, db: Session):
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=RUNNING_STUCK_SECONDS)

        stuck_jobs = db.query(ScheduledJob).filter(
            ScheduledJob.status == 'running',
            ScheduledJob.updated_at.isnot(None),
            ScheduledJob.updated_at < cutoff,
        ).all()

        if not stuck_jobs:
            return

        for job in stuck_jobs:
            new_retry_count = job.retry_count + 1
            if new_retry_count > MAX_RETRIES:
                db.execute(
                    update(ScheduledJob)
                    .where(ScheduledJob.id == job.id)
                    .values(
                        status='failed',
                        last_error='Recovered job exceeded max retries after timeout',
                        retry_count=new_retry_count,
                        updated_at=now,
                    )
                )
                logger.warning(
                    "job_recovery_failed job_id=%s deployment_id=%s retry_count=%s",
                    str(job.id),
                    str(job.deployment_id),
                    new_retry_count,
                )
            else:
                db.execute(
                    update(ScheduledJob)
                    .where(ScheduledJob.id == job.id)
                    .values(
                        status='pending',
                        last_error='Recovered job after timeout',
                        retry_count=new_retry_count,
                        scheduled_at=now,
                        updated_at=now,
                    )
                )
                logger.warning(
                    "job_recovered job_id=%s deployment_id=%s retry_count=%s",
                    str(job.id),
                    str(job.deployment_id),
                    new_retry_count,
                )

        db.commit()

    def _next_retry_delay(self, retry_count: int) -> int:
        if retry_count <= 0:
            return RETRY_BACKOFF_SECONDS[0]
        if retry_count <= len(RETRY_BACKOFF_SECONDS):
            return RETRY_BACKOFF_SECONDS[retry_count - 1]
        return RETRY_BACKOFF_SECONDS[-1]

    def _execute_job(self, db: Session, job: ScheduledJob):
        # Marquer comme running (idempotent)
        result = db.execute(
            update(ScheduledJob)
            .where(ScheduledJob.id == job.id, ScheduledJob.status == 'pending')
            .values(status='running', updated_at=datetime.now(timezone.utc))
        )
        db.commit()

        if result.rowcount == 0:
            # Job déjà pris par un autre poller
            logger.info("job_already_claimed job_id=%s", str(job.id))
            return

        try:
            logger.info(
                "job_started job_id=%s deployment_id=%s job_type=%s phase=%s",
                str(job.id),
                str(job.deployment_id),
                job.job_type,
                job.phase,
            )

            if job.job_type == 'pre_collect':
                self._execute_pre_collect(db, job)

            elif job.job_type == 'post_collect':
                self._execute_post_collect(db, job)

            elif job.job_type == 'analysis':
                self._execute_analysis(db, job)

            # Marquer comme completed
            db.execute(
                update(ScheduledJob)
                .where(ScheduledJob.id == job.id)
                .values(status='completed', updated_at=datetime.now(timezone.utc))
            )
            logger.info("job_completed job_id=%s", str(job.id))

        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            new_retry_count = job.retry_count + 1
            if new_retry_count <= MAX_RETRIES:
                delay_seconds = self._next_retry_delay(new_retry_count)
                scheduled_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
                db.execute(
                    update(ScheduledJob)
                    .where(ScheduledJob.id == job.id)
                    .values(
                        status='pending',
                        last_error=error_msg,
                        retry_count=new_retry_count,
                        scheduled_at=scheduled_at,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                logger.warning(
                    "job_retry_scheduled job_id=%s retry_count=%s delay_seconds=%s",
                    str(job.id),
                    new_retry_count,
                    delay_seconds,
                )
            else:
                logger.exception("job_failed job_id=%s error=%s", str(job.id), error_msg)
                db.execute(
                    update(ScheduledJob)
                    .where(ScheduledJob.id == job.id)
                    .values(
                        status='failed',
                        last_error=error_msg,
                        retry_count=new_retry_count,
                        updated_at=datetime.now(timezone.utc),
                    )
                )

        finally:
            db.commit()

    def _execute_pre_collect(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        metrics_endpoint = metadata.get('metrics_endpoint')
        use_hmac = metadata.get('use_hmac', False)
        hmac_secret = metadata.get('hmac_secret')
        project_id = metadata.get('project_id')

        if not metrics_endpoint:
            raise ValueError(f"Missing metrics_endpoint in job_metadata for job {job.id}")

        logger.info(
            "pre_collect_execute job_id=%s deployment_id=%s metrics_endpoint=%s use_hmac=%s project_id=%s",
            str(job.id),
            str(job.deployment_id),
            metrics_endpoint,
            bool(use_hmac),
            str(project_id) if project_id else None,
        )

        collect_metrics(
            deployment_id=job.deployment_id,
            phase='pre',
            metrics_endpoint=metrics_endpoint,
            db=db,
            use_hmac=use_hmac,
            secret=hmac_secret,
            project_id=project_id,
        )

    def _execute_post_collect(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        metrics_endpoint = metadata.get('metrics_endpoint')
        use_hmac = metadata.get('use_hmac', False)
        hmac_secret = metadata.get('hmac_secret')
        project_id = metadata.get('project_id')

        if not metrics_endpoint:
            raise ValueError(f"Missing metrics_endpoint in job_metadata for job {job.id}")

        logger.info(
            "post_collect_execute job_id=%s deployment_id=%s metrics_endpoint=%s use_hmac=%s project_id=%s sequence_index=%s",
            str(job.id),
            str(job.deployment_id),
            metrics_endpoint,
            bool(use_hmac),
            str(project_id) if project_id else None,
            job.sequence_index,
        )

        collect_metrics(
            deployment_id=job.deployment_id,
            phase='post',
            metrics_endpoint=metrics_endpoint,
            db=db,
            use_hmac=use_hmac,
            secret=hmac_secret,
            project_id=project_id,
        )

    def _execute_analysis(self, db: Session, job: ScheduledJob):
        logger.info(
            "analysis_execute job_id=%s deployment_id=%s",
            str(job.id),
            str(job.deployment_id),
        )
        analyze_deployment(deployment_id=job.deployment_id, db=db)


# Singleton poller instance
poller = JobPoller()
