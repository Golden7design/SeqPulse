from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.models.scheduled_job import ScheduledJob
from app.scheduler import poller as poller_module
from app.scheduler.poller import JobPoller, MAX_RETRIES


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
