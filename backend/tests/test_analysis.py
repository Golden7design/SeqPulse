from datetime import datetime, timedelta, timezone
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


def test_analyze_deployment_flags_exceed_ratio_breaches(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.5, collected_at=now)]
    post = [
        _sample(latency=350, error_rate=0.02, cpu=0.9, memory=0.7, rps=1.4, collected_at=now),
        _sample(latency=330, error_rate=0.015, cpu=0.85, memory=0.7, rps=1.3, collected_at=now),
        _sample(latency=280, error_rate=0.002, cpu=0.75, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=290, error_rate=0.002, cpu=0.74, memory=0.7, rps=1.3, collected_at=now),
        _sample(latency=260, error_rate=0.002, cpu=0.73, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=250, error_rate=0.002, cpu=0.72, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=240, error_rate=0.002, cpu=0.71, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=230, error_rate=0.002, cpu=0.7, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=220, error_rate=0.002, cpu=0.7, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=210, error_rate=0.002, cpu=0.7, memory=0.7, rps=1.2, collected_at=now),
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
    assert any("latency_p95 exceed_ratio" in flag for flag in flags)
    assert any("error_rate exceed_ratio" in flag for flag in flags)
    assert any("cpu_usage exceed_ratio" in flag for flag in flags)


def test_analyze_deployment_flags_rps_drop_when_persistent(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.002, cpu=0.3, memory=0.4, rps=100.0, collected_at=now)]
    post = [
        _sample(latency=140, error_rate=0.004, cpu=0.35, memory=0.45, rps=70.0, collected_at=now),
        _sample(latency=145, error_rate=0.0042, cpu=0.36, memory=0.46, rps=70.0, collected_at=now),
        _sample(latency=120, error_rate=0.002, cpu=0.32, memory=0.42, rps=70.0, collected_at=now),
        _sample(latency=120, error_rate=0.002, cpu=0.32, memory=0.42, rps=70.0, collected_at=now),
        _sample(latency=120, error_rate=0.002, cpu=0.32, memory=0.42, rps=90.0, collected_at=now),
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
    assert captured["verdict"]["verdict"] in {"warning", "rollback_recommended"}
    flags = captured["verdict"]["details"]
    assert any("requests_per_sec drop_ratio" in flag for flag in flags)


def test_analyze_deployment_skips_rps_drop_when_baseline_is_zero(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=80, error_rate=0.001, cpu=0.2, memory=0.3, rps=0.0, collected_at=now)]
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
    assert captured["verdict"]["verdict"] in {"ok", "warning", "rollback_recommended"}
    assert not any("requests_per_sec drop_ratio" in flag for flag in captured["verdict"]["details"])


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
    assert db.commit_count == 0


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

    lifecycle_calls = {"email": 0}

    def _fake_schedule_verdict_lifecycle(**_kwargs):
        lifecycle_calls["email"] += 1

    monkeypatch.setattr(engine, "_create_verdict", _fake_create_verdict)
    monkeypatch.setattr(engine, "generate_sdh_hints", _fake_generate_sdh_hints)
    monkeypatch.setattr(engine, "_schedule_verdict_lifecycle_emails", _fake_schedule_verdict_lifecycle)

    assert engine.analyze_deployment(dep_id, db_first) is True
    assert engine.analyze_deployment(dep_id, db_second) is True
    assert calls["sdh"] == 1
    assert lifecycle_calls["email"] == 1


def test_analyze_deployment_uses_mean_pre_baseline_for_hints(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [
        _sample(latency=100, error_rate=0.002, cpu=0.3, memory=0.4, rps=120.0, collected_at=now),
        _sample(latency=200, error_rate=0.004, cpu=0.5, memory=0.6, rps=80.0, collected_at=now),
    ]
    post = [
        _sample(latency=210, error_rate=0.005, cpu=0.55, memory=0.62, rps=90.0, collected_at=now),
    ]
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    captured = {}

    monkeypatch.setattr(engine, "_create_verdict", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(engine, "_schedule_verdict_lifecycle_emails", lambda **_kwargs: None)

    def _fake_generate_sdh_hints(**kwargs):
        captured["pre_agg"] = kwargs["pre_agg"]
        return []

    monkeypatch.setattr(engine, "generate_sdh_hints", _fake_generate_sdh_hints)

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert db.commit_count == 1
    assert captured["pre_agg"]["latency_p95"] == 150.0
    assert captured["pre_agg"]["error_rate"] == 0.003
    assert captured["pre_agg"]["cpu_usage"] == 0.4
    assert captured["pre_agg"]["memory_usage"] == 0.5
    assert captured["pre_agg"]["requests_per_sec"] == 100.0


def test_analyze_deployment_emits_quality_observation_for_rollback(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.5, collected_at=now)]
    post = [
        _sample(latency=350, error_rate=0.02, cpu=0.9, memory=0.7, rps=1.4, collected_at=now),
        _sample(latency=330, error_rate=0.015, cpu=0.85, memory=0.7, rps=1.3, collected_at=now),
        _sample(latency=280, error_rate=0.002, cpu=0.75, memory=0.7, rps=1.2, collected_at=now),
        _sample(latency=290, error_rate=0.002, cpu=0.74, memory=0.7, rps=1.3, collected_at=now),
        _sample(latency=260, error_rate=0.002, cpu=0.73, memory=0.7, rps=1.2, collected_at=now),
    ]
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    quality_calls = []

    monkeypatch.setattr(engine, "_create_verdict", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(engine, "_schedule_verdict_lifecycle_emails", lambda **_kwargs: None)
    monkeypatch.setattr(
        engine,
        "generate_sdh_hints",
        lambda **_kwargs: [SimpleNamespace(severity="critical")],
    )
    monkeypatch.setattr(engine, "observe_analysis_quality", lambda **kwargs: quality_calls.append(kwargs))

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert len(quality_calls) == 1
    assert quality_calls[0]["verdict"] == "rollback_recommended"
    assert quality_calls[0]["created"] is True
    assert quality_calls[0]["critical_failed"] is True
    assert "error_rate" in quality_calls[0]["failed_metrics"]


def test_analyze_deployment_emits_quality_observation_on_insufficient_data(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.5, collected_at=now)]
    post = []
    db = _db_for_analyze(deployment=deployment, pre_samples=pre, post_samples=post)

    quality_calls = []

    monkeypatch.setattr(engine, "_create_verdict", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(engine, "observe_analysis_quality", lambda **kwargs: quality_calls.append(kwargs))

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    assert len(quality_calls) == 1
    assert quality_calls[0]["verdict"] == "warning"
    assert quality_calls[0]["created"] is True
    assert quality_calls[0]["failed_metrics"] == set()
    assert quality_calls[0]["hints"] == []


def test_schedule_verdict_lifecycle_emails_for_first_warning(monkeypatch):
    owner_id = uuid4()
    project_id = uuid4()
    deployment_id = uuid4()

    deployment = SimpleNamespace(
        id=deployment_id,
        project_id=project_id,
        deployment_number=42,
        env="prod",
        project=SimpleNamespace(
            name="Checkout API",
            owner=SimpleNamespace(
                id=owner_id,
                name="Nassir Diallo",
                email="owner@example.com",
            ),
        ),
    )

    calls = []

    monkeypatch.setattr(engine, "_is_first_project_verdict", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(engine, "schedule_notification_outbox", lambda **kwargs: calls.append(kwargs))

    engine._schedule_verdict_lifecycle_emails(
        db=SimpleNamespace(),
        deployment=deployment,
        verdict="warning",
    )

    assert len(calls) == 1
    outbox_call = calls[0]
    assert outbox_call["deployment_id"] == deployment_id
    assert outbox_call["project_id"] == project_id
    assert outbox_call["user_id"] == owner_id
    assert outbox_call["autocommit"] is False
    notifications = outbox_call["notifications"]
    assert len(notifications) == 2
    assert [item["channel"] for item in notifications] == ["email", "email"]
    assert {item["payload"]["email_type"] for item in notifications} == {"E-ACT-04", "E-ACT-05"}
    assert {item["payload"]["to_email"] for item in notifications} == {"owner@example.com"}
    assert {item["payload"]["project_id"] for item in notifications} == {str(project_id)}


def test_schedule_verdict_lifecycle_emails_only_critical_when_not_first(monkeypatch):
    owner_id = uuid4()
    project_id = uuid4()
    deployment_id = uuid4()

    deployment = SimpleNamespace(
        id=deployment_id,
        project_id=project_id,
        deployment_number=7,
        env="staging",
        project=SimpleNamespace(
            name="Billing API",
            owner=SimpleNamespace(
                id=owner_id,
                name="Billing Owner",
                email="billing@example.com",
            ),
        ),
    )

    calls = []

    monkeypatch.setattr(engine, "_is_first_project_verdict", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(engine, "schedule_notification_outbox", lambda **kwargs: calls.append(kwargs))

    engine._schedule_verdict_lifecycle_emails(
        db=SimpleNamespace(),
        deployment=deployment,
        verdict="rollback_recommended",
    )

    assert len(calls) == 1
    notifications = calls[0]["notifications"]
    assert len(notifications) == 1
    assert notifications[0]["channel"] == "email"
    assert notifications[0]["payload"]["email_type"] == "E-ACT-05"
    assert notifications[0]["payload"]["dedupe_key"] == f"critical_verdict_alert:{deployment_id}"


def test_evaluate_data_quality_flags_min_post_samples():
    now = datetime.now(timezone.utc)
    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.0, collected_at=now)]
    post = [
        _sample(latency=120, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=now),
        _sample(latency=121, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=now),
    ]

    score, issues = engine._evaluate_data_quality(pre_samples=pre, post_samples=post)

    assert score < 1.0
    assert any(issue.startswith("min_post_samples") for issue in issues)


def test_evaluate_data_quality_flags_incoherent_timestamps():
    pre_time = datetime.now(timezone.utc)
    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.0, collected_at=pre_time)]
    post = [
        _sample(
            latency=120,
            error_rate=0.002,
            cpu=0.35,
            memory=0.45,
            rps=1.1,
            collected_at=pre_time - timedelta(minutes=5),
        )
    ]

    score, issues = engine._evaluate_data_quality(pre_samples=pre, post_samples=post)

    assert score < 1.0
    assert "incoherent_timestamps post_before_pre" in issues


def test_evaluate_data_quality_flags_sequence_gaps():
    t0 = datetime.now(timezone.utc)
    pre = [_sample(latency=100, error_rate=0.001, cpu=0.3, memory=0.4, rps=1.0, collected_at=t0)]
    post = [
        _sample(latency=120, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=t0),
        _sample(latency=121, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=t0 + timedelta(seconds=60)),
        _sample(latency=122, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=t0 + timedelta(seconds=300)),
        _sample(latency=123, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=t0 + timedelta(seconds=360)),
        _sample(latency=124, error_rate=0.002, cpu=0.35, memory=0.45, rps=1.1, collected_at=t0 + timedelta(seconds=420)),
    ]

    score, issues = engine._evaluate_data_quality(pre_samples=pre, post_samples=post)

    assert score < 1.0
    assert any(issue.startswith("sequence_gaps count=") for issue in issues)


def test_analyze_deployment_attaches_data_quality_score_to_verdict_details(monkeypatch):
    dep_id = uuid4()
    deployment = SimpleNamespace(id=dep_id, state="finished")
    now = datetime.now(timezone.utc)

    pre = [_sample(latency=100, error_rate=0.002, cpu=0.3, memory=0.4, rps=120.0, collected_at=now)]
    post = [
        _sample(latency=140, error_rate=0.004, cpu=0.35, memory=0.45, rps=70.0, collected_at=now),
        _sample(latency=145, error_rate=0.0042, cpu=0.36, memory=0.46, rps=70.0, collected_at=now + timedelta(seconds=60)),
        _sample(latency=120, error_rate=0.002, cpu=0.32, memory=0.42, rps=70.0, collected_at=now + timedelta(seconds=240)),
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
    monkeypatch.setattr(engine, "_schedule_verdict_lifecycle_emails", lambda **_kwargs: None)

    ok = engine.analyze_deployment(dep_id, db)

    assert ok is True
    details = captured["verdict"]["details"]
    assert any(item.startswith("data_quality_score ") for item in details)
    assert any(item.startswith("data_quality_issue ") for item in details)
