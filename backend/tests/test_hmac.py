from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest

from app.metrics.collector import collect_metrics
from app.metrics.security import (
    MAX_SKEW_FUTURE,
    MAX_SKEW_PAST,
    build_signature,
    canonicalize_path,
    validate_timestamp,
)


class _FakeCollectorDB:
    def __init__(self):
        self.samples = []
        self.commits = 0
        self.rollbacks = 0

    def add(self, sample):
        self.samples.append(sample)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _metric_payload():
    return {
        "metrics": {
            "requests_per_sec": 10.0,
            "latency_p95": 120.0,
            "error_rate": 0.002,
            "cpu_usage": 0.42,
            "memory_usage": 0.51,
        }
    }


def test_canonicalize_path_normalizes_missing_prefix_and_trailing_slash():
    assert canonicalize_path("") == "/"
    assert canonicalize_path("ds-metrics") == "/ds-metrics"
    assert canonicalize_path("/ds-metrics/") == "/ds-metrics"
    assert canonicalize_path("/") == "/"


def test_validate_timestamp_rejects_past_and_future_skew():
    too_old = (datetime.now(timezone.utc) - timedelta(seconds=MAX_SKEW_PAST + 1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    too_future = (datetime.now(timezone.utc) + timedelta(seconds=MAX_SKEW_FUTURE + 1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    with pytest.raises(ValueError, match="Timestamp too old"):
        validate_timestamp(too_old)

    with pytest.raises(ValueError, match="Timestamp too far in the future"):
        validate_timestamp(too_future)


def test_build_signature_changes_when_nonce_changes():
    secret = "test-secret"
    timestamp = "2026-02-13T12:00:00Z"
    path = "/ds-metrics"

    nonce_a = "nonce-a"
    nonce_b = "nonce-b"

    signature_a1 = build_signature(secret, timestamp, path, method="GET", nonce=nonce_a)
    signature_a2 = build_signature(secret, timestamp, path, method="GET", nonce=nonce_a)
    signature_b = build_signature(secret, timestamp, path, method="GET", nonce=nonce_b)

    assert signature_a1 == signature_a2
    assert signature_a1 != signature_b


def test_collect_metrics_uses_canonical_path_in_hmac_headers(monkeypatch):
    captured = {}

    def _fake_get(url, headers=None, timeout=5):
        captured["url"] = url
        captured["headers"] = headers or {}
        request = httpx.Request("GET", url)
        return httpx.Response(status_code=200, json=_metric_payload(), request=request)

    monkeypatch.setattr(httpx, "get", _fake_get)

    db = _FakeCollectorDB()
    collect_metrics(
        deployment_id=uuid4(),
        phase="post",
        metrics_endpoint="https://example.com/ds-metrics/?foo=1#frag",
        db=db,
        use_hmac=True,
        secret="shared-secret",
        project_id="project-123",
    )

    headers = captured["headers"]
    assert headers["X-SeqPulse-Canonical-Path"] == "/ds-metrics"
    assert headers["X-SeqPulse-Method"] == "GET"
    assert headers["X-SeqPulse-Signature"].startswith("sha256=")
    assert headers["X-SeqPulse-Nonce"]
    assert db.commits == 1
    assert len(db.samples) == 1


def test_collect_metrics_surfaces_replay_related_hmac_errors(monkeypatch):
    def _fake_get(url, headers=None, timeout=5):
        request = httpx.Request("GET", url, headers=headers)
        return httpx.Response(status_code=401, json={"detail": "Nonce reuse"}, request=request)

    monkeypatch.setattr(httpx, "get", _fake_get)

    db = _FakeCollectorDB()
    with pytest.raises(ValueError, match="nonce usage"):
        collect_metrics(
            deployment_id=uuid4(),
            phase="pre",
            metrics_endpoint="https://example.com/ds-metrics",
            db=db,
            use_hmac=True,
            secret="shared-secret",
        )
