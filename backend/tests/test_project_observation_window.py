from types import SimpleNamespace

from app.projects.observation import (
    project_can_customize_observation_window,
    resolve_project_observation_window_minutes,
)


def _project(*, plan: str, observation_window_minutes: int | None):
    return SimpleNamespace(plan=plan, observation_window_minutes=observation_window_minutes)


def test_free_projects_are_forced_to_5_minutes():
    free_project = _project(plan="free", observation_window_minutes=15)

    assert project_can_customize_observation_window(free_project) is False
    assert resolve_project_observation_window_minutes(free_project) == 5


def test_pro_projects_default_to_15_minutes_when_not_configured():
    pro_project = _project(plan="pro", observation_window_minutes=None)

    assert project_can_customize_observation_window(pro_project) is True
    assert resolve_project_observation_window_minutes(pro_project) == 15


def test_pro_projects_can_use_5_minutes():
    pro_project = _project(plan="pro", observation_window_minutes=5)

    assert resolve_project_observation_window_minutes(pro_project) == 5
