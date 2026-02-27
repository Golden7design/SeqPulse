from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.projects import endpoint_lock


class _FakeDB:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, _obj):
        return None


def _project(**overrides):
    data = {
        "id": uuid4(),
        "plan": "pro",
        "metrics_endpoint_candidate": "https://example.com/ds-metrics",
        "metrics_endpoint_active": None,
        "endpoint_state": "pending_verification",
        "endpoint_host_lock": None,
        "endpoint_change_count": 0,
        "endpoint_migration_count": 0,
        "endpoint_last_test_error_code": None,
        "endpoint_last_verified_at": None,
        "baseline_version": 1,
        "hmac_enabled": False,
        "hmac_secret": "hmac-secret",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_normalize_endpoint_ignores_port_query_and_fragment():
    normalized = endpoint_lock.normalize_endpoint_or_raise(
        "HTTPS://EXAMPLE.com:8443/ds-metrics/?foo=1#anchor"
    )

    assert normalized == "https://example.com/ds-metrics"


def test_update_candidate_rejects_when_path_change_limit_is_exceeded():
    db = _FakeDB()
    project = _project(
        plan="free",
        metrics_endpoint_active="https://example.com/ds-metrics",
        endpoint_host_lock="example.com",
        endpoint_change_count=1,
    )

    with pytest.raises(HTTPException) as exc_info:
        endpoint_lock.update_project_endpoint_candidate(
            db=db,
            project=project,
            endpoint="https://example.com/new-metrics",
            actor_user_id=uuid4(),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "CHANGE_LIMIT_EXCEEDED"
    assert db.commits == 0


def test_test_and_activate_candidate_increments_change_counter_and_baseline(monkeypatch):
    db = _FakeDB()
    project = _project(
        metrics_endpoint_candidate="https://example.com/new-path",
        metrics_endpoint_active="https://example.com/ds-metrics",
        endpoint_state="active",
        endpoint_host_lock="example.com",
    )

    monkeypatch.setattr(endpoint_lock, "probe_metrics_endpoint_hmac", lambda **_kwargs: None)

    updated = endpoint_lock.test_and_activate_project_endpoint_candidate(
        db=db,
        project=project,
        actor_user_id=uuid4(),
    )

    assert updated.metrics_endpoint_active == "https://example.com/new-path"
    assert updated.endpoint_state == "active"
    assert updated.endpoint_change_count == 1
    assert updated.endpoint_migration_count == 0
    assert updated.baseline_version == 2
    assert updated.endpoint_last_test_error_code is None
    assert db.commits == 1


def test_test_and_activate_candidate_marks_failure_when_probe_fails(monkeypatch):
    db = _FakeDB()
    project = _project(metrics_endpoint_candidate="https://example.com/ds-metrics")

    def _raise_probe_error(**_kwargs):
        raise ValueError("network down")

    monkeypatch.setattr(endpoint_lock, "probe_metrics_endpoint_hmac", _raise_probe_error)

    with pytest.raises(HTTPException) as exc_info:
        endpoint_lock.test_and_activate_project_endpoint_candidate(
            db=db,
            project=project,
            actor_user_id=uuid4(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "ENDPOINT_TEST_FAILED"
    assert project.endpoint_last_test_error_code == "ENDPOINT_TEST_FAILED"
    assert db.commits == 1


def test_resolve_active_endpoint_for_deployment_rejects_mismatch():
    project = _project(metrics_endpoint_active="https://example.com/ds-metrics", endpoint_state="active")

    with pytest.raises(HTTPException) as exc_info:
        endpoint_lock.resolve_active_endpoint_for_deployment(
            project=project,
            payload_endpoint="https://other.example.com/ds-metrics",
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "ENDPOINT_MISMATCH"

