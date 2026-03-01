from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.analysis.constants import INDUSTRIAL_THRESHOLDS
from app.sdh import routes as sdh_routes


class _FakeSDHListQuery:
    def __init__(self, rows):
        self._rows = rows

    def join(self, *_args, **_kwargs):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def all(self):
        return list(self._rows)


class _FakeSDHListDB:
    def __init__(self, rows):
        self._rows = rows

    def query(self, *_models):
        return _FakeSDHListQuery(self._rows)


def test_list_sdh_builds_composite_signals_with_audit_and_phase_aggregates(monkeypatch):
    deployment_id = uuid4()
    owner_id = uuid4()
    hint_id = uuid4()
    created_at = datetime.now(timezone.utc)

    hint = SimpleNamespace(
        id=hint_id,
        deployment_id=deployment_id,
        severity="critical",
        metric="composite",
        observed_value=None,
        threshold=None,
        secured_threshold=None,
        exceed_ratio=None,
        tolerance=None,
        confidence=0.9,
        title="Partial outage suspected",
        diagnosis="diag",
        suggested_actions=["action"],
        audit_data={
            "error_rate": {
                "secured_threshold": 0.009,
                "exceed_ratio": 0.4,
                "tolerance": 0.05,
            },
            "requests_per_sec": {
                "secured_threshold": 96.0,
                "exceed_ratio": 0.5,
                "tolerance": 0.2,
            },
        },
        created_at=created_at,
    )
    deployment = SimpleNamespace(id=deployment_id, deployment_number=42, env="prod")
    project = SimpleNamespace(id=uuid4(), owner_id=owner_id, name="Checkout")
    db = _FakeSDHListDB(rows=[(hint, deployment, project)])

    monkeypatch.setattr(
        sdh_routes,
        "_aggregate_metrics_by_phase",
        lambda **_kwargs: {
            deployment_id: {
                "pre": {"requests_per_sec": 120.0},
                "post": {"requests_per_sec": 90.0, "error_rate": 0.02},
            }
        },
    )

    result = sdh_routes.list_sdh(
        limit=50,
        current_user=SimpleNamespace(id=owner_id),
        db=db,
    )

    assert len(result) == 1
    row = result[0]
    assert row.deployment_id == "dpl_42"
    assert len(row.composite_signals) == 2

    signals_by_metric = {signal.metric: signal for signal in row.composite_signals}
    assert signals_by_metric["error_rate"].threshold == INDUSTRIAL_THRESHOLDS["error_rate"]
    assert signals_by_metric["error_rate"].secured_threshold == 0.009
    assert signals_by_metric["error_rate"].exceed_ratio == 0.4
    assert signals_by_metric["error_rate"].tolerance == 0.05
    assert signals_by_metric["requests_per_sec"].threshold == 120.0
    assert signals_by_metric["requests_per_sec"].secured_threshold == 96.0
    assert signals_by_metric["requests_per_sec"].exceed_ratio == 0.5
    assert signals_by_metric["requests_per_sec"].tolerance == 0.2


def test_list_sdh_returns_no_composite_signals_for_non_composite_hint(monkeypatch):
    deployment_id = uuid4()
    owner_id = uuid4()
    hint = SimpleNamespace(
        id=uuid4(),
        deployment_id=deployment_id,
        severity="warning",
        metric="latency_p95",
        observed_value=350.0,
        threshold=300.0,
        secured_threshold=270.0,
        exceed_ratio=0.4,
        tolerance=0.2,
        confidence=0.7,
        title="Latency high",
        diagnosis="diag",
        suggested_actions=["action"],
        audit_data={"latency_p95": {"secured_threshold": 270.0, "exceed_ratio": 0.4, "tolerance": 0.2}},
        created_at=datetime.now(timezone.utc),
    )
    deployment = SimpleNamespace(id=deployment_id, deployment_number=43, env="prod")
    project = SimpleNamespace(id=uuid4(), owner_id=owner_id, name="Checkout")
    db = _FakeSDHListDB(rows=[(hint, deployment, project)])

    monkeypatch.setattr(sdh_routes, "_aggregate_metrics_by_phase", lambda **_kwargs: {})

    result = sdh_routes.list_sdh(
        limit=50,
        current_user=SimpleNamespace(id=owner_id),
        db=db,
    )

    assert len(result) == 1
    assert result[0].metric == "latency_p95"
    assert result[0].composite_signals == []
