from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.analysis import engine


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


class _FakeVerdictDB:
    def __init__(self, scalars):
        self._scalars = list(scalars)
        self.execute_calls = []
        self.commit_count = 0

    def execute(self, statement):
        self.execute_calls.append(statement)
        return _FakeScalarResult(self._scalars.pop(0))

    def commit(self):
        self.commit_count += 1


def _sample(*, latency, error_rate, cpu, memory, rps, collected_at):
    return SimpleNamespace(
        latency_p95=latency,
        error_rate=error_rate,
        cpu_usage=cpu,
        memory_usage=memory,
        requests_per_sec=rps,
        collected_at=collected_at,
    )


def _db_for_analyze(*, deployment, pre_samples, post_samples):
    class _Query:
        def __init__(self, first_result=None, all_result=None):
            self._first_result = first_result
            self._all_result = all_result

        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return self._first_result

        def filter_by(self, **_kwargs):
            return self

        def all(self):
            return list(self._all_result)

    class _DB:
        def __init__(self):
            self.commit_count = 0
            self._queries = [
                _Query(first_result=deployment),
                _Query(all_result=pre_samples),
                _Query(all_result=post_samples),
            ]

        def query(self, _model):
            return self._queries.pop(0)

        def commit(self):
            self.commit_count += 1

    return _DB()


def test_analyze_deployment_flags_absolute_threshold_breaches(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.5, collected_at=now)]
    post = [
        _sample(latency=350, error_rate=0.02, cpu=0.9, memory=0.9, rps=1.4, collected_at=now),
        _sample(latency=330, error_rate=0.015, cpu=0.85, memory=0.88, rps=1.3, collected_at=now),
    ]
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    captured = {}

    def _fake_create_verdict(*args, **kwargs):
        if kwargs:
            captured["verdict"] = kwargs
        else:
            captured["verdict"] = {
                "db": args[0],
                "deployment_id": args[1],
                "verdict": args[2],
                "confidence": args[3],
                "summary": args[4],
                "details": args[5],
            }
        return True

    monkeypatch.setattr(engine, "_create_verdict", _fake_create_verdict)
    monkeypatch.setattr(engine, "generate_sdh_hints", lambda **_kwargs: [])

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert deployment.state == "analyzed"
    assert captured["verdict"]["verdict"] == "rollback_recommended"
    flags = captured["verdict"]["details"]
    assert "latency_p95 > 300ms" in flags
    assert "error_rate > 1%" in flags
    assert "cpu_usage > 80%" in flags
    assert "memory_usage > 85%" in flags


def test_analyze_deployment_applies_relative_comparison_when_pre_traffic_significant(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.002, cpu=0.3, memory=0.4, rps=1.0, collected_at=now)]
    post = [
        _sample(latency=140, error_rate=0.004, cpu=0.35, memory=0.45, rps=0.5, collected_at=now),
        _sample(latency=145, error_rate=0.0042, cpu=0.36, memory=0.46, rps=0.52, collected_at=now),
    ]
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    captured = {}

    def _fake_create_verdict(*args, **kwargs):
        if kwargs:
            captured["verdict"] = kwargs
        else:
            captured["verdict"] = {
                "db": args[0],
                "deployment_id": args[1],
                "verdict": args[2],
                "confidence": args[3],
                "summary": args[4],
                "details": args[5],
            }
        return True

    monkeypatch.setattr(engine, "_create_verdict", _fake_create_verdict)
    monkeypatch.setattr(engine, "generate_sdh_hints", lambda **_kwargs: [])

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert captured["verdict"]["verdict"] == "rollback_recommended"
    flags = captured["verdict"]["details"]
    assert "latency_p95 increased >30% vs PRE" in flags
    assert "error_rate increased >50% vs PRE" in flags
    assert "traffic dropped >40% vs PRE" in flags


def test_analyze_deployment_skips_relative_checks_when_pre_traffic_is_too_low(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=80, error_rate=0.001, cpu=0.2, memory=0.3, rps=0.05, collected_at=now)]
    post = [
        _sample(latency=180, error_rate=0.006, cpu=0.3, memory=0.5, rps=0.01, collected_at=now),
        _sample(latency=190, error_rate=0.007, cpu=0.32, memory=0.52, rps=0.009, collected_at=now),
    ]
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    captured = {}

    def _fake_create_verdict(*args, **kwargs):
        if kwargs:
            captured["verdict"] = kwargs
        else:
            captured["verdict"] = {
                "db": args[0],
                "deployment_id": args[1],
                "verdict": args[2],
                "confidence": args[3],
                "summary": args[4],
                "details": args[5],
            }
        return True

    monkeypatch.setattr(engine, "_create_verdict", _fake_create_verdict)
    monkeypatch.setattr(engine, "generate_sdh_hints", lambda **_kwargs: [])

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert captured["verdict"]["verdict"] == "ok"
    assert captured["verdict"]["details"] == []


def test_create_verdict_is_idempotent_based_on_insert_result():
    deployment_id = uuid4()
    created_verdict_id = uuid4()
    db = _FakeVerdictDB([created_verdict_id, None])

    first = engine._create_verdict(
        db=db,
        deployment_id=deployment_id,
        verdict="warning",
        confidence=0.7,
        summary="first",
        details=["flag"],
    )
    second = engine._create_verdict(
        db=db,
        deployment_id=deployment_id,
        verdict="warning",
        confidence=0.7,
        summary="duplicate",
        details=["flag"],
    )

    assert first is True
    assert second is False
    assert len(db.execute_calls) == 2
    assert db.commit_count == 2


def test_analyze_deployment_generates_sdh_only_when_verdict_created(monkeypatch):
    dep_id = uuid4()
    now = datetime.now(timezone.utc)

    deployment_a = SimpleNamespace(id=dep_id, state="finished")
    deployment_b = SimpleNamespace(id=dep_id, state="finished")
    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.0, collected_at=now)]
    post = [_sample(latency=120, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=now)]

    db_first = _db_for_analyze(deployment=deployment_a, pre_samples=pre, post_samples=post)
    db_second = _db_for_analyze(deployment=deployment_b, pre_samples=pre, post_samples=post)

    calls = {"sdh": 0}
    create_responses = [True, False]

    def _fake_create_verdict(*_args, **_kwargs):
        return create_responses.pop(0)

    def _fake_generate_sdh_hints(**_kwargs):
        calls["sdh"] += 1
        return []

    monkeypatch.setattr(engine, "_create_verdict", _fake_create_verdict)
    monkeypatch.setattr(engine, "generate_sdh_hints", _fake_generate_sdh_hints)

    assert engine.analyze_deployment(dep_id, db_first) is True
    assert engine.analyze_deployment(dep_id, db_second) is True
    assert calls["sdh"] == 1
