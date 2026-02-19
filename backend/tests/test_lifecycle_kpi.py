from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.analytics import lifecycle_kpi as kpi


def test_compute_window_bounds_clamps_range():
    now = datetime(2026, 2, 19, 12, 0, tzinfo=timezone.utc)

    start_min, end_min, days_min = kpi.compute_window_bounds(window_days=0, now=now)
    start_max, end_max, days_max = kpi.compute_window_bounds(window_days=365, now=now)

    assert days_min == 1
    assert start_min == now - timedelta(days=1)
    assert end_min == now

    assert days_max == 90
    assert start_max == now - timedelta(days=90)
    assert end_max == now


def test_compute_lifecycle_kpis_aggregates_expected_values(monkeypatch):
    db = SimpleNamespace()
    window_start = datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)
    window_end = datetime(2026, 2, 8, 0, 0, tzinfo=timezone.utc)

    user_1 = uuid4()
    user_2 = uuid4()
    project_1 = uuid4()
    project_2 = uuid4()
    project_3 = uuid4()

    user_1_created = datetime(2026, 2, 2, 10, 0, tzinfo=timezone.utc)
    user_2_created = datetime(2026, 2, 2, 11, 0, tzinfo=timezone.utc)
    project_1_created = datetime(2026, 2, 3, 9, 0, tzinfo=timezone.utc)
    project_2_created = datetime(2026, 2, 3, 10, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        kpi,
        "_query_user_signup_cohort",
        lambda *_args, **_kwargs: [(user_1, user_1_created), (user_2, user_2_created)],
    )
    monkeypatch.setattr(
        kpi,
        "_query_projects_for_owners",
        lambda *_args, **_kwargs: [
            (user_1, user_1_created + timedelta(hours=2)),
            (user_2, user_2_created + timedelta(hours=30)),
        ],
    )
    monkeypatch.setattr(
        kpi,
        "_query_project_cohort",
        lambda *_args, **_kwargs: [(project_1, project_1_created), (project_2, project_2_created)],
    )
    monkeypatch.setattr(
        kpi,
        "_query_verdict_times_for_projects",
        lambda *_args, **_kwargs: [
            (project_1, project_1_created + timedelta(hours=5)),
            (project_2, project_2_created + timedelta(hours=80)),
        ],
    )
    monkeypatch.setattr(
        kpi,
        "_query_exposed_projects",
        lambda *_args, **_kwargs: [project_1, project_2, project_3],
    )
    monkeypatch.setattr(kpi, "_count_converted_exposed_projects", lambda *_args, **_kwargs: 1)
    monkeypatch.setattr(
        kpi,
        "_critical_alert_open_rate",
        lambda *_args, **_kwargs: {
            "value": None,
            "numerator": None,
            "denominator": None,
            "available": False,
            "reason": "email_events_table_missing",
        },
    )

    result = kpi.compute_lifecycle_kpis(db=db, window_start=window_start, window_end=window_end)

    assert result["signup_to_project_24h"]["value"] == 50.0
    assert result["signup_to_project_24h"]["numerator"] == 1
    assert result["signup_to_project_24h"]["denominator"] == 2

    assert result["project_to_first_verdict_72h"]["value"] == 50.0
    assert result["project_to_first_verdict_72h"]["numerator"] == 1
    assert result["project_to_first_verdict_72h"]["denominator"] == 2

    assert result["free_to_pro_from_quota_emails"]["value"] == 33.33
    assert result["free_to_pro_from_quota_emails"]["numerator"] == 1
    assert result["free_to_pro_from_quota_emails"]["denominator"] == 3

    assert result["critical_alert_open_rate"]["available"] is False
    assert result["critical_alert_open_rate"]["reason"] == "email_events_table_missing"
