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
    assert db.commit_count == 0


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


def test_generate_sdh_hints_replaces_existing_hints_without_new_signals():
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
    assert db.commit_count == 0


def test_generate_sdh_hints_aligns_with_metrics_audit_for_persistent_breaches():
    db = _FakeSDHDB()
    now = datetime.now(timezone.utc)

    hints = generate_sdh_hints(
        db=db,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 120.0,
            "latency_p95": 180.0,
            "error_rate": 0.002,
            "cpu_usage": 0.45,
            "memory_usage": 0.55,
        },
        post_agg={
            # Below absolute industrial thresholds, but persistent breaches in audit ratios.
            "requests_per_sec": 105.0,
            "latency_p95": 240.0,
            "error_rate": 0.008,
            "cpu_usage": 0.6,
            "memory_usage": 0.65,
        },
        created_at=now,
        metrics_audit={
            "error_rate": {
                "secured_threshold": 0.009,
                "exceed_ratio": 0.30,
                "tolerance": 0.05,
            },
            "requests_per_sec": {
                "secured_threshold": 96.0,
                "exceed_ratio": 0.40,
                "tolerance": 0.20,
            },
        },
    )

    assert hints
    assert any(h.metric == "composite" for h in hints)
    assert any(h.severity == "critical" for h in hints)
    composite = next(h for h in hints if h.metric == "composite")
    assert set((composite.audit_data or {}).keys()) == {"error_rate", "requests_per_sec"}
    assert db.added == hints


def test_generate_sdh_hints_uses_audit_as_priority_when_metric_is_covered():
    db = _FakeSDHDB()
    now = datetime.now(timezone.utc)

    hints = generate_sdh_hints(
        db=db,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 100.0,
            "latency_p95": 160.0,
            "error_rate": 0.002,
            "cpu_usage": 0.4,
            "memory_usage": 0.5,
        },
        post_agg={
            # Above absolute threshold, but audit says this did not persist.
            "requests_per_sec": 100.0,
            "latency_p95": 360.0,
            "error_rate": 0.003,
            "cpu_usage": 0.45,
            "memory_usage": 0.55,
        },
        created_at=now,
        metrics_audit={
            "latency_p95": {
                "secured_threshold": 270.0,
                "exceed_ratio": 0.10,
                "tolerance": 0.20,
            },
        },
    )

    assert all(h.metric != "latency_p95" for h in hints)


def test_generate_sdh_hints_stores_metric_local_audit_payload():
    db = _FakeSDHDB()
    now = datetime.now(timezone.utc)

    hints = generate_sdh_hints(
        db=db,
        deployment=_deployment(),
        pre_agg={
            "requests_per_sec": 100.0,
            "latency_p95": 200.0,
            "error_rate": 0.002,
            "cpu_usage": 0.4,
            "memory_usage": 0.5,
        },
        post_agg={
            "requests_per_sec": 100.0,
            "latency_p95": 260.0,
            "error_rate": 0.003,
            "cpu_usage": 0.85,
            "memory_usage": 0.55,
        },
        created_at=now,
        metrics_audit={
            "latency_p95": {
                "secured_threshold": 270.0,
                "exceed_ratio": 0.10,
                "tolerance": 0.20,
            },
            "cpu_usage": {
                "secured_threshold": 0.72,
                "exceed_ratio": 0.40,
                "tolerance": 0.20,
            },
        },
    )

    cpu_hint = next(h for h in hints if h.metric == "cpu_usage")
    assert set((cpu_hint.audit_data or {}).keys()) == {"cpu_usage"}
