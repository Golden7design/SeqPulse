from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.db.models.scheduled_job import ScheduledJob
from app.scheduler.cleanup import cleanup_hmac_jobs_for_deployment


class _FakeQuery:
    def __init__(self, jobs):
        self._jobs = list(jobs)

    def filter(self, *criteria):
        filtered = self._jobs
        for criterion in criteria:
            field_name = getattr(criterion.left, "key", None)
            expected = getattr(criterion.right, "value", None)
            if field_name is None:
                continue
            filtered = [job for job in filtered if getattr(job, field_name, None) == expected]
        self._jobs = filtered
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._jobs)


class _FakeDB:
    def __init__(self, jobs):
        self._jobs = list(jobs)
        self.commits = 0

    def query(self, model):
        if model is ScheduledJob:
            return _FakeQuery(self._jobs)
        return _FakeQuery([])

    def commit(self):
        self.commits += 1


def _job(*, deployment_id, job_type, status, last_error=None):
    return SimpleNamespace(
        id=uuid4(),
        deployment_id=deployment_id,
        job_type=job_type,
        status=status,
        last_error=last_error,
        created_at=datetime.now(timezone.utc),
        updated_at=None,
    )


def test_cleanup_hmac_jobs_marks_pending_jobs_failed():
    deployment_id = uuid4()
    jobs = [
        _job(
            deployment_id=deployment_id,
            job_type="post_collect",
            status="failed",
            last_error="MetricsHMACValidationError: HMAC validation failed",
        ),
        _job(deployment_id=deployment_id, job_type="post_collect", status="pending"),
        _job(deployment_id=deployment_id, job_type="analysis", status="running"),
    ]
    db = _FakeDB(jobs)

    result = cleanup_hmac_jobs_for_deployment(db, deployment_id=deployment_id, dry_run=False)

    assert result["has_hmac_failure"] is True
    assert result["cleaned_jobs"] == 2
    assert db.commits == 1
    assert jobs[1].status == "failed"
    assert jobs[2].status == "failed"


def test_cleanup_hmac_jobs_dry_run_does_not_persist():
    deployment_id = uuid4()
    jobs = [
        _job(
            deployment_id=deployment_id,
            job_type="pre_collect",
            status="failed",
            last_error="HMAC validation failed: nonce usage",
        ),
        _job(deployment_id=deployment_id, job_type="post_collect", status="pending"),
    ]
    db = _FakeDB(jobs)

    result = cleanup_hmac_jobs_for_deployment(db, deployment_id=deployment_id, dry_run=True)

    assert result["has_hmac_failure"] is True
    assert result["cleaned_jobs"] == 1
    assert db.commits == 0
    assert jobs[1].status == "pending"


def test_cleanup_hmac_jobs_no_marker_does_nothing():
    deployment_id = uuid4()
    jobs = [
        _job(deployment_id=deployment_id, job_type="post_collect", status="pending"),
        _job(deployment_id=deployment_id, job_type="analysis", status="pending"),
    ]
    db = _FakeDB(jobs)

    result = cleanup_hmac_jobs_for_deployment(db, deployment_id=deployment_id, dry_run=False)

    assert result["has_hmac_failure"] is False
    assert result["cleaned_jobs"] == 0
    assert db.commits == 0
    assert jobs[0].status == "pending"
