from datetime import datetime, timezone
from types import SimpleNamespace

from app.analytics import routes as analytics_routes


def test_lifecycle_kpis_route_returns_window_and_payload(monkeypatch):
    fixed_start = datetime(2026, 2, 12, 10, 0, tzinfo=timezone.utc)
    fixed_end = datetime(2026, 2, 19, 10, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        analytics_routes,
        "compute_window_bounds",
        lambda **_kwargs: (fixed_start, fixed_end, 7),
    )
    monkeypatch.setattr(
        analytics_routes,
        "compute_lifecycle_kpis",
        lambda **_kwargs: {"signup_to_project_24h": {"value": 50.0, "numerator": 1, "denominator": 2}},
    )

    result = analytics_routes.lifecycle_kpis(window_days=7, db=SimpleNamespace())

    assert result["window"]["from"] == fixed_start.isoformat()
    assert result["window"]["to"] == fixed_end.isoformat()
    assert result["window"]["days"] == 7
    assert result["kpis"]["signup_to_project_24h"]["value"] == 50.0
