from datetime import datetime, timezone
from types import SimpleNamespace

from app.analysis.sdh import generate_sdh_hints


class _FakeSDHQuery:
    def __init__(self, delete_count: int):
        self._delete_count = delete_count
        self.delete_sync = None

    def filter(self, *_args, **_kwargs):
        return self

    def delete(self, synchronize_session=False):
        self.delete_sync = synchronize_session
        return self._delete_count


class _FakeSDHDB:
    def __init__(self, delete_count: int = 0):
        self.query_obj = _FakeSDHQuery(delete_count=delete_count)
        self.added = []
        self.commit_count = 0

    def query(self, _model):
        return self.query_obj

    def add_all(self, hints):
        self.added.extend(hints)

    def commit(self):
        self.commit_count += 1


def _deployment():
    return SimpleNamespace(id="dep-1")


def test_generate_sdh_hints_creates_composite_and_suppresses_single_metric_hints():
    db = _FakeSDHDB()
    now = datetime.now(timezone.utc)

    hints = generate_sdh_hints(
        db=db,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 1.0,
            "latency_p95": 180.0,
            "error_rate": 0.001,
            "cpu_usage": 0.4,
            "memory_usage": 0.82,
        },
        post_agg={
            "requests_per_sec": 1.0,
            "latency_p95": 400.0,
            "error_rate": 0.02,
            "cpu_usage": 0.5,
            "memory_usage": 0.82,
        },
        created_at=now,
    )

    metrics = [hint.metric for hint in hints]
    assert "composite" in metrics
    assert "error_rate" not in metrics
    assert "latency_p95" not in metrics

    composite = next(h for h in hints if h.metric == "composite")
    assert composite.severity == "critical"
    assert composite.confidence == 0.95

    assert db.added == hints
    assert db.query_obj.delete_sync is False
    assert db.commit_count == 1


def test_generate_sdh_hints_confidence_escalates_with_stronger_signals():
    now = datetime.now(timezone.utc)

    db_warning = _FakeSDHDB()
    warning_hints = generate_sdh_hints(
        db=db_warning,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 0.2,
            "latency_p95": 200.0,
            "error_rate": 0.001,
            "cpu_usage": 0.3,
            "memory_usage": 0.82,
        },
        post_agg={
            "requests_per_sec": 0.2,
            "latency_p95": 360.0,
            "error_rate": 0.001,
            "cpu_usage": 0.3,
            "memory_usage": 0.82,
        },
        created_at=now,
    )
    latency_warning = next(h for h in warning_hints if h.metric == "latency_p95")

    db_critical = _FakeSDHDB()
    critical_hints = generate_sdh_hints(
        db=db_critical,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 1.0,
            "latency_p95": 150.0,
            "error_rate": 0.001,
            "cpu_usage": 0.4,
            "memory_usage": 0.82,
        },
        post_agg={
            "requests_per_sec": 1.0,
            "latency_p95": 450.0,
            "error_rate": 0.025,
            "cpu_usage": 0.4,
            "memory_usage": 0.82,
        },
        created_at=now,
    )
    composite_critical = next(h for h in critical_hints if h.metric == "composite")

    assert composite_critical.confidence > latency_warning.confidence
    assert composite_critical.confidence <= 0.95


def test_generate_sdh_hints_commits_when_replacing_existing_hints_without_new_signals():
    db = _FakeSDHDB(delete_count=2)
    now = datetime.now(timezone.utc)

    hints = generate_sdh_hints(
        db=db,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 0.05,
            "latency_p95": 200.0,
            "error_rate": 0.001,
            "cpu_usage": 0.2,
            "memory_usage": 0.7,
        },
        post_agg={
            "requests_per_sec": 0.05,
            "latency_p95": 200.0,
            "error_rate": 0.001,
            "cpu_usage": 0.2,
            "memory_usage": 0.7,
        },
        created_at=now,
    )

    assert hints == []
    assert db.added == []
    assert db.commit_count == 1
