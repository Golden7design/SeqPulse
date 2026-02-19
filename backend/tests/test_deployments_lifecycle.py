from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.deployments import services
from app.email.types import EMAIL_TYPE_FREE_QUOTA_80, EMAIL_TYPE_FREE_QUOTA_REACHED


class _FakeQuery:
    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return None


class _FakeDB:
    def __init__(self):
        self.added = []

    def query(self, _model):
        return _FakeQuery()

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        return None

    def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid4()

    def rollback(self):
        return None


def _project(*, plan: str = "free"):
    return SimpleNamespace(
        id=uuid4(),
        name="Checkout API",
        owner_id=uuid4(),
        envs=["prod"],
        plan=plan,
        hmac_enabled=False,
        hmac_secret="hmac-secret",
        owner=None,
    )


def _payload():
    return SimpleNamespace(
        env="prod",
        idempotency_key=None,
        branch="main",
        metrics_endpoint=None,
    )


def test_trigger_blocks_when_free_quota_reached(monkeypatch):
    db = _FakeDB()
    project = _project(plan="free")
    payload = _payload()
    scheduled_calls = []

    monkeypatch.setattr(services, "_count_project_monthly_deployments", lambda **_kwargs: 50)
    monkeypatch.setattr(services, "_schedule_free_quota_email", lambda **kwargs: scheduled_calls.append(kwargs))

    with pytest.raises(HTTPException) as exc_info:
        services.trigger_deployment_flow(db=db, project=project, payload=payload, idempotency_key=None)

    assert exc_info.value.status_code == 402
    assert len(scheduled_calls) == 1
    assert scheduled_calls[0]["email_type"] == EMAIL_TYPE_FREE_QUOTA_REACHED
    assert scheduled_calls[0]["deployments_used"] == 50


def test_trigger_schedules_80_percent_email_when_crossing_threshold(monkeypatch):
    db = _FakeDB()
    project = _project(plan="free")
    payload = _payload()
    scheduled_calls = []

    monkeypatch.setattr(services, "_count_project_monthly_deployments", lambda **_kwargs: 39)
    monkeypatch.setattr(services, "_next_project_deployment_number", lambda **_kwargs: 12)
    monkeypatch.setattr(services, "_schedule_free_quota_email", lambda **kwargs: scheduled_calls.append(kwargs))

    result = services.trigger_deployment_flow(db=db, project=project, payload=payload, idempotency_key=None)

    assert result["status"] == "created"
    assert len(scheduled_calls) == 1
    assert scheduled_calls[0]["email_type"] == EMAIL_TYPE_FREE_QUOTA_80
    assert scheduled_calls[0]["deployments_used"] == 40


def test_month_bounds_returns_month_start_and_next_month_start():
    now = datetime(2026, 2, 19, 15, 30, tzinfo=timezone.utc)
    month_start, month_end = services._month_bounds(now)

    assert month_start.isoformat() == "2026-02-01T00:00:00+00:00"
    assert month_end.isoformat() == "2026-03-01T00:00:00+00:00"
