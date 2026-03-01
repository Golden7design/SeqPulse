# app/scheduler/poller.py
import asyncio
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Optional
import structlog
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.core.settings import settings
from app.db.session import SessionLocal
from app.db.models.deployment import Deployment
from app.db.models.scheduled_job import ScheduledJob
from app.metrics.collector import MetricsHMACValidationError, collect_metrics
from app.analysis.engine import analyze_deployment
from app.email.service import send_email_if_not_sent
from app.slack.service import send_slack_if_not_sent
from app.observability.metrics import (
    inc_scheduler_jobs_failed,
    observe_scheduler_job_start_delay,
    set_scheduler_jobs_pending,
)

logger = structlog.get_logger(__name__)

POLL_INTERVAL = max(1, int(settings.SCHEDULER_POLL_INTERVAL_SECONDS))
MAX_CONCURRENT_JOBS = max(1, int(settings.SCHEDULER_MAX_CONCURRENT_JOBS))
RUNNING_STUCK_SECONDS = max(1, int(settings.SCHEDULER_RUNNING_STUCK_SECONDS))
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [30, 120, 300]  # retry #1, #2, #3
FAIRNESS_LOOKAHEAD_MULTIPLIER = max(1, int(settings.SCHEDULER_FAIRNESS_LOOKAHEAD_MULTIPLIER))


class JobPoller:
    def __init__(self):
        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.last_heartbeat_at: Optional[datetime] = None

    def _touch_heartbeat(self):
        self.last_heartbeat_at = datetime.now(timezone.utc)

    async def start(self):
        self.running = True
        self._touch_heartbeat()
        self.task = asyncio.create_task(self._poll_forever())
        logger.info("job_poller_started", poll_interval_seconds=POLL_INTERVAL)

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
            self._touch_heartbeat()
            try:
                await asyncio.to_thread(self._process_pending_jobs)
            except Exception as e:
                logger.exception("poller_loop_error", error=str(e))
            finally:
                self._touch_heartbeat()
            await asyncio.sleep(POLL_INTERVAL)

    def _process_pending_jobs(self):
        db = SessionLocal()
        try:
            self._recover_stuck_jobs(db)
            self._update_pending_jobs_gauge(db)

            now = datetime.now(timezone.utc)
            lookahead_limit = max(MAX_CONCURRENT_JOBS, MAX_CONCURRENT_JOBS * FAIRNESS_LOOKAHEAD_MULTIPLIER)
            due_jobs = db.query(ScheduledJob).filter(
                ScheduledJob.status == 'pending',
                ScheduledJob.scheduled_at <= now
            ).order_by(ScheduledJob.scheduled_at).limit(lookahead_limit).all()

            if not due_jobs:
                return

            selected_jobs = self._select_jobs_with_fairness(db=db, jobs=due_jobs, limit=MAX_CONCURRENT_JOBS)
            if not selected_jobs:
                return

            logger.info(
                "processing_jobs",
                jobs_count=len(selected_jobs),
                due_jobs_count=len(due_jobs),
                max_concurrent_jobs=MAX_CONCURRENT_JOBS,
            )
            self._execute_jobs_concurrently([job.id for job in selected_jobs])

            with SessionLocal() as gauge_db:
                self._update_pending_jobs_gauge(gauge_db)

        except Exception as e:
            logger.exception("poller_error", error=str(e))
        finally:
            db.close()

    def _execute_jobs_concurrently(self, job_ids: list):
        if not job_ids:
            return

        with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENT_JOBS, len(job_ids))) as executor:
            futures = {
                executor.submit(self._execute_job_by_id, job_id): str(job_id)
                for job_id in job_ids
            }
            for future in as_completed(futures):
                job_id = futures[future]
                try:
                    future.result()
                except Exception as e:
                    logger.exception("job_worker_error", job_id=job_id, error=str(e))

    def _execute_job_by_id(self, job_id):
        db = SessionLocal()
        try:
            job = db.get(ScheduledJob, job_id)
            if job is None:
                logger.info("job_missing_on_execution", job_id=str(job_id))
                return
            self._execute_job(db, job)
        finally:
            db.close()

    def _select_jobs_with_fairness(self, db: Session, jobs: list[ScheduledJob], limit: int) -> list[ScheduledJob]:
        if not jobs:
            return []
        if len(jobs) <= 1:
            return jobs[:limit]

        deployment_ids = {job.deployment_id for job in jobs if job.deployment_id}
        deployment_to_project = {}
        if deployment_ids:
            try:
                for deployment_id, project_id in db.query(Deployment.id, Deployment.project_id).filter(
                    Deployment.id.in_(deployment_ids)
                ).all():
                    deployment_to_project[deployment_id] = project_id
            except Exception as e:
                logger.warning(
                    "fairness_project_lookup_failed",
                    deployments_count=len(deployment_ids),
                    error=str(e),
                )

        grouped: dict[str, deque[ScheduledJob]] = defaultdict(deque)
        key_order: list[str] = []

        for job in jobs:
            fairness_key = self._fairness_key(job=job, deployment_to_project=deployment_to_project)
            if not grouped[fairness_key]:
                key_order.append(fairness_key)
            grouped[fairness_key].append(job)

        selected: list[ScheduledJob] = []
        while len(selected) < limit:
            progressed = False
            for key in key_order:
                queue = grouped[key]
                if not queue:
                    continue
                selected.append(queue.popleft())
                progressed = True
                if len(selected) >= limit:
                    break
            if not progressed:
                break
        return selected

    def _fairness_key(self, job: ScheduledJob, deployment_to_project: dict) -> str:
        metadata = job.job_metadata or {}
        project_id = metadata.get("project_id")
        user_id = metadata.get("user_id")
        if project_id:
            return f"project:{project_id}"
        if user_id:
            return f"user:{user_id}"
        deployment_project = deployment_to_project.get(job.deployment_id)
        if deployment_project:
            return f"project:{deployment_project}"
        if job.deployment_id:
            return f"deployment:{job.deployment_id}"
        return f"job:{job.id}"

    def _update_pending_jobs_gauge(self, db: Session) -> None:
        pending_jobs = db.query(ScheduledJob).filter(ScheduledJob.status == 'pending').count()
        set_scheduler_jobs_pending(pending_jobs)

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
                    "job_recovery_failed",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    retry_count=new_retry_count,
                )
                inc_scheduler_jobs_failed()
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
                    "job_recovered",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    retry_count=new_retry_count,
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
        claimed_at = datetime.now(timezone.utc)
        result = db.execute(
            update(ScheduledJob)
            .where(ScheduledJob.id == job.id, ScheduledJob.status == 'pending')
            .values(status='running', updated_at=claimed_at)
        )
        db.commit()

        if result.rowcount == 0:
            # Job déjà pris par un autre poller
            logger.info("job_already_claimed", job_id=str(job.id))
            return
        scheduled_at = job.scheduled_at
        if scheduled_at is not None:
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            delay_seconds = max(0.0, (claimed_at - scheduled_at).total_seconds())
            observe_scheduler_job_start_delay(job_type=job.job_type, delay_seconds=delay_seconds)

        started_at = time.perf_counter()
        try:
            logger.info(
                "job_started",
                job_id=str(job.id),
                deployment_id=str(job.deployment_id),
                job_type=job.job_type,
                phase=job.phase,
            )

            if job.job_type == 'pre_collect':
                self._execute_pre_collect(db, job)

            elif job.job_type == 'post_collect':
                self._execute_post_collect(db, job)

            elif job.job_type == 'analysis':
                self._execute_analysis(db, job)

            elif job.job_type == 'email_send':
                self._execute_email_send(db, job)

            elif job.job_type == 'slack_send':
                self._execute_slack_send(db, job)

            elif job.job_type == 'notification_outbox':
                self._execute_notification_outbox(db, job)

            # Marquer comme completed
            db.execute(
                update(ScheduledJob)
                .where(ScheduledJob.id == job.id)
                .values(status='completed', updated_at=datetime.now(timezone.utc))
            )
            logger.info(
                "job_completed",
                job_id=str(job.id),
                deployment_id=str(job.deployment_id),
                job_type=job.job_type,
                phase=job.phase,
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )

        except Exception as e:
            # Clear failed transactional state (DB timeout/deadlock/etc.) before updating retry status.
            try:
                db.rollback()
            except Exception as rollback_error:
                logger.warning(
                    "job_failure_rollback_failed",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    rollback_error=f"{type(rollback_error).__name__}: {rollback_error}",
                )
            error_msg = f"{type(e).__name__}: {str(e)}"
            new_retry_count = job.retry_count + 1
            if isinstance(e, MetricsHMACValidationError):
                logger.warning(
                    "job_failed_non_retryable",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    job_type=job.job_type,
                    phase=job.phase,
                    error=error_msg,
                )
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
                self._cancel_related_jobs_after_hmac_failure(db=db, failed_job=job)
                inc_scheduler_jobs_failed()
            elif new_retry_count <= MAX_RETRIES:
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
                    "job_retry_scheduled",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    retry_count=new_retry_count,
                    delay_seconds=delay_seconds,
                    error=error_msg,
                )
            else:
                logger.exception(
                    "job_failed",
                    job_id=str(job.id),
                    deployment_id=str(job.deployment_id),
                    retry_count=new_retry_count,
                    error=error_msg,
                    duration_ms=int((time.perf_counter() - started_at) * 1000),
                )
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
                inc_scheduler_jobs_failed()

        finally:
            db.commit()

    def _cancel_related_jobs_after_hmac_failure(self, db: Session, failed_job: ScheduledJob):
        if not failed_job.deployment_id:
            return

        now = datetime.now(timezone.utc)
        cleanup_reason = (
            f"Cancelled after non-retryable HMAC failure on sibling job {failed_job.id}"
        )
        cancelled_count = 0

        for job_type in ("pre_collect", "post_collect", "analysis"):
            for status in ("pending", "running"):
                result = db.execute(
                    update(ScheduledJob)
                    .where(
                        ScheduledJob.deployment_id == failed_job.deployment_id,
                        ScheduledJob.job_type == job_type,
                        ScheduledJob.status == status,
                    )
                    .values(
                        status='failed',
                        last_error=cleanup_reason,
                        updated_at=now,
                    )
                )
                cancelled_count += result.rowcount

        if cancelled_count > 0:
            logger.warning(
                "deployment_jobs_cancelled_after_hmac_failure",
                deployment_id=str(failed_job.deployment_id),
                failed_job_id=str(failed_job.id),
                cancelled_jobs=cancelled_count,
            )

    def _execute_pre_collect(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        metrics_endpoint = metadata.get('metrics_endpoint')
        use_hmac = metadata.get('use_hmac', False)
        hmac_secret = metadata.get('hmac_secret')
        project_id = metadata.get('project_id')

        if not metrics_endpoint:
            raise ValueError(f"Missing metrics_endpoint in job_metadata for job {job.id}")

        logger.info(
            "pre_collect_execute",
            job_id=str(job.id),
            deployment_id=str(job.deployment_id),
            metrics_endpoint=metrics_endpoint,
            use_hmac=bool(use_hmac),
            project_id=str(project_id) if project_id else None,
            phase="pre",
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
            "post_collect_execute",
            job_id=str(job.id),
            deployment_id=str(job.deployment_id),
            metrics_endpoint=metrics_endpoint,
            use_hmac=bool(use_hmac),
            project_id=str(project_id) if project_id else None,
            sequence_index=job.sequence_index,
            phase="post",
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
            "analysis_execute",
            job_id=str(job.id),
            deployment_id=str(job.deployment_id),
        )
        analyze_deployment(deployment_id=job.deployment_id, db=db)

    def _execute_notification_outbox(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        notifications = metadata.get("notifications")
        if not isinstance(notifications, list) or not notifications:
            raise ValueError("Missing required outbox metadata key: notifications")

        for idx, notification in enumerate(notifications):
            if not isinstance(notification, dict):
                raise ValueError(f"Invalid outbox notification at index={idx}: expected object")

            channel = notification.get("channel")
            payload = notification.get("payload")
            if not isinstance(payload, dict):
                raise ValueError(f"Invalid outbox notification payload at index={idx}")

            adapter_job = SimpleNamespace(id=job.id, job_metadata=payload)
            if channel == "email":
                self._execute_email_send(db, adapter_job)
            elif channel == "slack":
                self._execute_slack_send(db, adapter_job)
            else:
                raise ValueError(f"Unsupported outbox channel at index={idx}: {channel}")

            logger.info(
                "notification_outbox_item_executed",
                outbox_job_id=str(job.id),
                deployment_id=str(job.deployment_id),
                index=idx,
                channel=channel,
                dedupe_key=payload.get("dedupe_key"),
            )

    def _execute_email_send(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        missing = [
            key
            for key in ("user_id", "to_email", "email_type", "dedupe_key")
            if not metadata.get(key)
        ]
        if missing:
            raise ValueError(f"Missing required email metadata keys: {', '.join(missing)}")

        context = metadata.get("context")
        if not isinstance(context, dict):
            context = {}

        result = send_email_if_not_sent(
            db=db,
            user_id=metadata["user_id"],
            to_email=metadata["to_email"],
            email_type=metadata["email_type"],
            dedupe_key=metadata["dedupe_key"],
            project_id=metadata.get("project_id"),
            context=context,
        )
        logger.info(
            "email_job_executed",
            job_id=str(job.id),
            status=result.status,
            email_delivery_id=result.email_delivery_id,
            provider_message_id=result.provider_message_id,
            reason=result.reason,
        )
        if result.status == "failed":
            raise RuntimeError(result.reason or "email_send_failed")

    def _execute_slack_send(self, db: Session, job: ScheduledJob):
        metadata = job.job_metadata or {}
        missing = [
            key
            for key in ("user_id", "project_id", "notification_type", "dedupe_key", "message_text")
            if not metadata.get(key)
        ]
        if missing:
            raise ValueError(f"Missing required slack metadata keys: {', '.join(missing)}")

        result = send_slack_if_not_sent(
            db=db,
            user_id=metadata["user_id"],
            project_id=metadata["project_id"],
            notification_type=metadata["notification_type"],
            dedupe_key=metadata["dedupe_key"],
            message_text=metadata["message_text"],
        )
        logger.info(
            "slack_job_executed",
            job_id=str(job.id),
            status=result.status,
            slack_delivery_id=result.slack_delivery_id,
            provider_message_id=result.provider_message_id,
            reason=result.reason,
        )
        if result.status == "failed":
            raise RuntimeError(result.reason or "slack_send_failed")


# Singleton poller instance
poller = JobPoller()
