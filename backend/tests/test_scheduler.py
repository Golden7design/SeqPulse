from datetime import datetime, timedelta, timezone
import os
import tempfile
from types import SimpleNamespace
import threading
from uuid import uuid4

import pytest
from sqlalchemy.exc import OperationalError, TimeoutError as SATimeoutError
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

from app.db.models.scheduled_job import ScheduledJob
from app.metrics.collector import MetricsHMACValidationError
from app.scheduler import poller as poller_module
from app.scheduler.poller import JobPoller, MAX_RETRIES


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@pytest.fixture
def scheduler_session_local():
    fd, db_path = tempfile.mkstemp(prefix="scheduler-tests-", suffix=".db")
    os.close(fd)
    engine = create_engine(
        f"sqlite+pysqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    ScheduledJob.__table__.create(bind=engine)
    try:
        yield SessionLocal
    finally:
        engine.dispose()
        try:
            os.remove(db_path)
        except FileNotFoundError:
            pass


class _ExecuteResult:
    def __init__(self, rowcount: int):
        self.rowcount = rowcount


class _FakeQuery:
    def __init__(self, jobs):
        self._jobs = jobs

    def filter(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._jobs)

    def count(self):
        return len([job for job in self._jobs if getattr(job, "status", None) == "pending"])


class _FakeSchedulerDB:
    def __init__(self, jobs=None, stuck_jobs=None):
        jobs = jobs or []
        self.jobs = {job.id: job for job in jobs}
        self.stuck_jobs = list(stuck_jobs or [])
        self.commit_count = 0
        self.rollback_count = 0

    def query(self, model):
        if model is ScheduledJob:
            return _FakeQuery(self.stuck_jobs)
        return _FakeQuery([])

    def execute(self, statement):
        values = {
            column.key: getattr(bind_value, "value", bind_value)
            for column, bind_value in statement._values.items()
        }
        rowcount = 0

        for job in self.jobs.values():
            if not self._matches_where(statement, job):
                continue
            for key, value in values.items():
                setattr(job, key, value)
            rowcount += 1

        return _ExecuteResult(rowcount=rowcount)

    def commit(self):
        self.commit_count += 1

    def rollback(self):
        self.rollback_count += 1

    @staticmethod
    def _matches_where(statement, job) -> bool:
        for criterion in statement._where_criteria:
            field_name = getattr(criterion.left, "key", None)
            expected = getattr(criterion.right, "value", None)
            if field_name is None or getattr(job, field_name) != expected:
                return False
        return True


def _job(*, status="pending", retry_count=0, job_type="analysis", updated_at=None):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        deployment_id=uuid4(),
        job_type=job_type,
        phase=None,
        sequence_index=None,
        status=status,
        retry_count=retry_count,
        last_error=None,
        scheduled_at=now,
        updated_at=updated_at or now,
        job_metadata={},
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def test_execute_job_skips_when_already_claimed(monkeypatch):
    poller = JobPoller()
    job = _job(status="running")
    db = _FakeSchedulerDB(jobs=[job])

    calls = {"analysis": 0}

    def _analysis(*_args, **_kwargs):
        calls["analysis"] += 1

    monkeypatch.setattr(poller, "_execute_analysis", _analysis)

    poller._execute_job(db, job)

    assert calls["analysis"] == 0
    assert job.status == "running"
    assert db.commit_count == 1


def test_execute_job_retries_with_backoff_when_execution_fails(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="analysis")
    db = _FakeSchedulerDB(jobs=[job])

    def _boom(*_args, **_kwargs):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(poller, "_execute_analysis", _boom)

    before = datetime.now(timezone.utc)
    poller._execute_job(db, job)

    assert job.status == "pending"
    assert job.retry_count == 1
    assert "RuntimeError: simulated failure" in job.last_error
    assert job.scheduled_at >= before + timedelta(seconds=25)
    assert db.commit_count >= 2
    assert db.rollback_count == 1


def test_execute_job_retries_when_analysis_hits_db_timeout(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="analysis")
    db = _FakeSchedulerDB(jobs=[job])

    def _timeout(*_args, **_kwargs):
        raise SATimeoutError("QueuePool timeout during analysis")

    monkeypatch.setattr(poller, "_execute_analysis", _timeout)

    before = datetime.now(timezone.utc)
    poller._execute_job(db, job)

    assert job.status == "pending"
    assert job.retry_count == 1
    assert "TimeoutError" in (job.last_error or "")
    assert job.scheduled_at >= before + timedelta(seconds=25)
    assert db.rollback_count == 1


def test_execute_job_retries_when_analysis_hits_deadlock(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="analysis")
    db = _FakeSchedulerDB(jobs=[job])

    def _deadlock(*_args, **_kwargs):
        raise OperationalError(
            statement="UPDATE deployment_verdicts ...",
            params={},
            orig=RuntimeError("deadlock detected"),
        )

    monkeypatch.setattr(poller, "_execute_analysis", _deadlock)

    before = datetime.now(timezone.utc)
    poller._execute_job(db, job)

    assert job.status == "pending"
    assert job.retry_count == 1
    assert "deadlock detected" in (job.last_error or "")
    assert job.scheduled_at >= before + timedelta(seconds=25)
    assert db.rollback_count == 1


def test_execute_job_does_not_retry_on_hmac_validation_error(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="analysis")
    db = _FakeSchedulerDB(jobs=[job])

    def _hmac_fail(*_args, **_kwargs):
        raise MetricsHMACValidationError("HMAC validation failed: nonce usage")

    monkeypatch.setattr(poller, "_execute_analysis", _hmac_fail)

    poller._execute_job(db, job)

    assert job.status == "failed"
    assert job.retry_count == 1
    assert "HMAC validation failed" in (job.last_error or "")
    assert db.commit_count >= 2


def test_execute_job_cancels_related_pending_jobs_after_hmac_failure(monkeypatch):
    poller = JobPoller()
    deployment_id = uuid4()

    failed_job = _job(status="pending", retry_count=0, job_type="post_collect")
    failed_job.deployment_id = deployment_id
    failed_job.phase = "post"

    sibling_post = _job(status="pending", retry_count=0, job_type="post_collect")
    sibling_post.deployment_id = deployment_id
    sibling_post.phase = "post"

    sibling_analysis = _job(status="pending", retry_count=0, job_type="analysis")
    sibling_analysis.deployment_id = deployment_id

    db = _FakeSchedulerDB(jobs=[failed_job, sibling_post, sibling_analysis])

    def _hmac_fail(*_args, **_kwargs):
        raise MetricsHMACValidationError("HMAC validation failed: nonce usage")

    monkeypatch.setattr(poller, "_execute_post_collect", _hmac_fail)

    poller._execute_job(db, failed_job)

    assert failed_job.status == "failed"
    assert sibling_post.status == "failed"
    assert sibling_analysis.status == "failed"
    assert "Cancelled after non-retryable HMAC failure" in (sibling_post.last_error or "")


def test_execute_job_handles_email_send_success(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="email_send")
    job.job_metadata = {
        "user_id": str(uuid4()),
        "to_email": "user@example.com",
        "email_type": "E-TRX-01",
        "dedupe_key": "trx01:user:2026-02-19",
        "project_id": None,
        "context": {"first_name": "Nassir"},
    }
    db = _FakeSchedulerDB(jobs=[job])

    captured = {}

    def _fake_send_email_if_not_sent(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(
            status="sent",
            email_delivery_id="del_123",
            provider_message_id="msg_123",
            reason=None,
        )

    monkeypatch.setattr(poller_module, "send_email_if_not_sent", _fake_send_email_if_not_sent)

    poller._execute_job(db, job)

    assert job.status == "completed"
    assert captured["email_type"] == "E-TRX-01"
    assert captured["to_email"] == "user@example.com"
    assert db.commit_count >= 2


def test_execute_job_retries_when_email_metadata_is_missing():
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="email_send")
    job.job_metadata = {"to_email": "missing@example.com"}
    db = _FakeSchedulerDB(jobs=[job])

    before = datetime.now(timezone.utc)
    poller._execute_job(db, job)

    assert job.status == "pending"
    assert job.retry_count == 1
    assert "Missing required email metadata keys" in (job.last_error or "")
    assert job.scheduled_at >= before + timedelta(seconds=25)


def test_execute_job_handles_notification_outbox_success(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="notification_outbox")
    user_id = str(uuid4())
    project_id = str(uuid4())
    job.job_metadata = {
        "dedupe_key": f"verdict_notifications:{uuid4()}",
        "project_id": project_id,
        "user_id": user_id,
        "notifications": [
            {
                "channel": "email",
                "payload": {
                    "user_id": user_id,
                    "to_email": "user@example.com",
                    "email_type": "E-ACT-05",
                    "dedupe_key": f"critical_verdict_alert:{uuid4()}",
                    "project_id": project_id,
                    "context": {"verdict": "warning"},
                },
            },
            {
                "channel": "slack",
                "payload": {
                    "user_id": user_id,
                    "project_id": project_id,
                    "notification_type": "S-ALRT-01",
                    "dedupe_key": f"slack:critical_verdict_alert:{uuid4()}",
                    "message_text": "Critical verdict",
                },
            },
        ],
    }
    db = _FakeSchedulerDB(jobs=[job])

    calls = {"email": 0, "slack": 0}

    def _fake_send_email_if_not_sent(**_kwargs):
        calls["email"] += 1
        return SimpleNamespace(
            status="sent",
            email_delivery_id="del_123",
            provider_message_id="msg_123",
            reason=None,
        )

    def _fake_send_slack_if_not_sent(**_kwargs):
        calls["slack"] += 1
        return SimpleNamespace(
            status="sent",
            slack_delivery_id="sdel_123",
            provider_message_id="smsg_123",
            reason=None,
        )

    monkeypatch.setattr(poller_module, "send_email_if_not_sent", _fake_send_email_if_not_sent)
    monkeypatch.setattr(poller_module, "send_slack_if_not_sent", _fake_send_slack_if_not_sent)

    poller._execute_job(db, job)

    assert job.status == "completed"
    assert calls == {"email": 1, "slack": 1}
    assert db.commit_count >= 2


def test_execute_job_retries_when_notification_outbox_channel_is_invalid():
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="notification_outbox")
    job.job_metadata = {
        "notifications": [
            {"channel": "sms", "payload": {"dedupe_key": "invalid"}},
        ]
    }
    db = _FakeSchedulerDB(jobs=[job])

    before = datetime.now(timezone.utc)
    poller._execute_job(db, job)

    assert job.status == "pending"
    assert job.retry_count == 1
    assert "Unsupported outbox channel" in (job.last_error or "")
    assert job.scheduled_at >= before + timedelta(seconds=25)


def test_execute_job_observes_start_delay_metric(monkeypatch):
    poller = JobPoller()
    job = _job(status="pending", retry_count=0, job_type="analysis")
    job.scheduled_at = datetime.now(timezone.utc) - timedelta(seconds=42)
    db = _FakeSchedulerDB(jobs=[job])

    observed = {}

    def _analysis(*_args, **_kwargs):
        return None

    def _observe(*, job_type: str, delay_seconds: float):
        observed["job_type"] = job_type
        observed["delay_seconds"] = delay_seconds

    monkeypatch.setattr(poller, "_execute_analysis", _analysis)
    monkeypatch.setattr(poller_module, "observe_scheduler_job_start_delay", _observe)

    poller._execute_job(db, job)

    assert observed["job_type"] == "analysis"
    assert observed["delay_seconds"] >= 40


def test_recover_stuck_jobs_marks_failed_after_retry_budget(monkeypatch):
    poller = JobPoller()
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=11)

    recoverable = _job(status="running", retry_count=0, updated_at=stale_time)
    exhausted = _job(status="running", retry_count=MAX_RETRIES, updated_at=stale_time)

    db = _FakeSchedulerDB(jobs=[recoverable, exhausted], stuck_jobs=[recoverable, exhausted])
    failed_counter_calls = {"count": 0}

    def _failed_counter():
        failed_counter_calls["count"] += 1

    monkeypatch.setattr(poller_module, "inc_scheduler_jobs_failed", _failed_counter)

    poller._recover_stuck_jobs(db)

    assert recoverable.status == "pending"
    assert recoverable.retry_count == 1
    assert recoverable.last_error == "Recovered job after timeout"

    assert exhausted.status == "failed"
    assert exhausted.retry_count == MAX_RETRIES + 1
    assert "exceeded max retries" in exhausted.last_error
    assert failed_counter_calls["count"] == 1
    assert db.commit_count == 1


@pytest.mark.parametrize(
    ("retry_count", "expected_seconds"),
    [
        (0, 30),
        (1, 30),
        (2, 120),
        (3, 300),
        (50, 300),
    ],
)
def test_next_retry_delay_uses_backoff_schedule(retry_count, expected_seconds):
    poller = JobPoller()
    assert poller._next_retry_delay(retry_count) == expected_seconds


def test_process_pending_jobs_persists_completed_status(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    now = datetime.now(timezone.utc)
    due_job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=now - timedelta(seconds=5),
        status="pending",
    )
    future_job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=now + timedelta(minutes=10),
        status="pending",
    )
    session.add_all([due_job, future_job])
    session.commit()
    due_job_id = due_job.id
    future_job_id = future_job.id
    session.close()

    execution_calls = {"count": 0}

    def _analysis(_db, _job):
        execution_calls["count"] += 1

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller, "_execute_analysis", _analysis)

    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    due_job_row = verify_session.get(ScheduledJob, due_job_id)
    future_job_row = verify_session.get(ScheduledJob, future_job_id)
    assert due_job_row is not None
    assert future_job_row is not None
    assert due_job_row.status == "completed"
    assert future_job_row.status == "pending"
    assert execution_calls["count"] == 1
    verify_session.close()


def test_process_pending_jobs_persists_retry_after_failure(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=datetime.now(timezone.utc) - timedelta(seconds=5),
        status="pending",
    )
    session.add(job)
    session.commit()
    job_id = job.id
    session.close()

    def _boom(_db, _job):
        raise RuntimeError("integration failure")

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller, "_execute_analysis", _boom)

    before = datetime.now(timezone.utc)
    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    failed_row = verify_session.get(ScheduledJob, job_id)
    assert failed_row is not None
    assert failed_row.status == "pending"
    assert failed_row.retry_count == 1
    assert "RuntimeError: integration failure" in (failed_row.last_error or "")
    assert _as_utc(failed_row.scheduled_at) >= before + timedelta(seconds=25)
    verify_session.close()


def test_process_pending_jobs_recovers_stale_running_job_once(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    stale_updated_at = datetime.now(timezone.utc) - timedelta(seconds=poller_module.RUNNING_STUCK_SECONDS + 5)
    stuck_job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        status="running",
        retry_count=0,
        updated_at=stale_updated_at,
    )
    session.add(stuck_job)
    session.commit()
    stuck_job_id = stuck_job.id
    session.close()

    execution_calls = {"count": 0}

    def _analysis(_db, _job):
        execution_calls["count"] += 1

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller, "_execute_analysis", _analysis)

    poller._process_pending_jobs()
    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    recovered_row = verify_session.get(ScheduledJob, stuck_job_id)
    assert recovered_row is not None
    assert recovered_row.status == "completed"
    assert recovered_row.retry_count == 1
    assert recovered_row.last_error == "Recovered job after timeout"
    assert execution_calls["count"] == 1
    verify_session.close()


def test_process_pending_jobs_executes_jobs_concurrently(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    now = datetime.now(timezone.utc)
    first = ScheduledJob(
        deployment_id=None,
        job_type="email_send",
        phase=None,
        scheduled_at=now - timedelta(seconds=2),
        status="pending",
        job_metadata={
            "user_id": str(uuid4()),
            "to_email": "a@example.com",
            "email_type": "E-TRX-01",
            "dedupe_key": f"a:{uuid4()}",
            "project_id": "project-A",
            "context": {},
        },
    )
    second = ScheduledJob(
        deployment_id=None,
        job_type="email_send",
        phase=None,
        scheduled_at=now - timedelta(seconds=1),
        status="pending",
        job_metadata={
            "user_id": str(uuid4()),
            "to_email": "b@example.com",
            "email_type": "E-TRX-01",
            "dedupe_key": f"b:{uuid4()}",
            "project_id": "project-B",
            "context": {},
        },
    )
    session.add_all([first, second])
    session.commit()
    first_id = first.id
    second_id = second.id
    session.close()

    started = []
    started_lock = threading.Lock()
    both_started = threading.Event()

    def _email_send_concurrent(_db, job):
        with started_lock:
            started.append(job.id)
            if len(started) == 2:
                both_started.set()
        if not both_started.wait(timeout=0.4):
            raise RuntimeError("jobs_not_started_concurrently")

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller, "_execute_email_send", _email_send_concurrent)

    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    first_row = verify_session.get(ScheduledJob, first_id)
    second_row = verify_session.get(ScheduledJob, second_id)
    assert first_row is not None
    assert second_row is not None
    assert first_row.status == "completed"
    assert second_row.status == "completed"
    assert len(started) == 2
    verify_session.close()


def test_process_pending_jobs_applies_project_fairness(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    now = datetime.now(timezone.utc)
    jobs = [
        ScheduledJob(
            deployment_id=None,
            job_type="email_send",
            phase=None,
            scheduled_at=now - timedelta(seconds=3),
            status="pending",
            job_metadata={
                "user_id": str(uuid4()),
                "to_email": "one@example.com",
                "email_type": "E-TRX-01",
                "dedupe_key": f"one:{uuid4()}",
                "project_id": "project-A",
                "context": {},
            },
        ),
        ScheduledJob(
            deployment_id=None,
            job_type="email_send",
            phase=None,
            scheduled_at=now - timedelta(seconds=2),
            status="pending",
            job_metadata={
                "user_id": str(uuid4()),
                "to_email": "two@example.com",
                "email_type": "E-TRX-01",
                "dedupe_key": f"two:{uuid4()}",
                "project_id": "project-A",
                "context": {},
            },
        ),
        ScheduledJob(
            deployment_id=None,
            job_type="email_send",
            phase=None,
            scheduled_at=now - timedelta(seconds=1),
            status="pending",
            job_metadata={
                "user_id": str(uuid4()),
                "to_email": "three@example.com",
                "email_type": "E-TRX-01",
                "dedupe_key": f"three:{uuid4()}",
                "project_id": "project-B",
                "context": {},
            },
        ),
    ]
    session.add_all(jobs)
    session.commit()
    ids = [job.id for job in jobs]
    session.close()

    executed_projects: list[str] = []
    executed_lock = threading.Lock()

    def _email_send_record(_db, job):
        with executed_lock:
            executed_projects.append((job.job_metadata or {}).get("project_id"))

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller_module, "MAX_CONCURRENT_JOBS", 2)
    monkeypatch.setattr(poller, "_execute_email_send", _email_send_record)

    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    rows = [verify_session.get(ScheduledJob, job_id) for job_id in ids]
    completed = [row for row in rows if row is not None and row.status == "completed"]
    pending = [row for row in rows if row is not None and row.status == "pending"]
    assert len(completed) == 2
    assert len(pending) == 1
    assert set(executed_projects) == {"project-A", "project-B"}
    verify_session.close()


def test_process_pending_jobs_recovers_after_scheduler_internal_error(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=datetime.now(timezone.utc) - timedelta(seconds=5),
        status="pending",
    )
    session.add(job)
    session.commit()
    job_id = job.id
    session.close()

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)

    failure_switch = {"first": True}
    original_execute_jobs_concurrently = poller._execute_jobs_concurrently

    def _flaky_execute_jobs(job_ids):
        if failure_switch["first"]:
            failure_switch["first"] = False
            raise RuntimeError("scheduler dispatcher failure")
        return original_execute_jobs_concurrently(job_ids)

    monkeypatch.setattr(poller, "_execute_jobs_concurrently", _flaky_execute_jobs)
    monkeypatch.setattr(poller, "_execute_analysis", lambda _db, _job: None)

    # First poll: scheduler internals fail before job execution; pending job must stay intact.
    poller._process_pending_jobs()
    verify_session: Session = scheduler_session_local()
    first_row = verify_session.get(ScheduledJob, job_id)
    assert first_row is not None
    assert first_row.status == "pending"
    verify_session.close()

    # Second poll: clean recovery and successful completion.
    poller._process_pending_jobs()
    verify_session = scheduler_session_local()
    second_row = verify_session.get(ScheduledJob, job_id)
    assert second_row is not None
    assert second_row.status == "completed"
    verify_session.close()


def test_restart_during_analysis_recovers_running_job_cleanly(monkeypatch, scheduler_session_local):
    session: Session = scheduler_session_local()
    stale_updated_at = datetime.now(timezone.utc) - timedelta(seconds=poller_module.RUNNING_STUCK_SECONDS + 5)
    stuck_job = ScheduledJob(
        deployment_id=uuid4(),
        job_type="analysis",
        phase=None,
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        status="running",
        retry_count=0,
        updated_at=stale_updated_at,
    )
    session.add(stuck_job)
    session.commit()
    stuck_job_id = stuck_job.id
    session.close()

    executions = {"count": 0}

    def _analysis(_db, _job):
        executions["count"] += 1

    poller = JobPoller()
    monkeypatch.setattr(poller_module, "SessionLocal", scheduler_session_local)
    monkeypatch.setattr(poller, "_execute_analysis", _analysis)

    # Simulates a new process recovering after previous process died mid-analysis.
    poller._process_pending_jobs()
    poller._process_pending_jobs()

    verify_session: Session = scheduler_session_local()
    row = verify_session.get(ScheduledJob, stuck_job_id)
    assert row is not None
    assert row.status == "completed"
    assert row.retry_count == 1
    assert row.last_error == "Recovered job after timeout"
    assert executions["count"] == 1
    verify_session.close()
