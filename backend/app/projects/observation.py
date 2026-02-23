from app.db.models.project import Project


FREE_OBSERVATION_WINDOW_MINUTES = 5
PRO_DEFAULT_OBSERVATION_WINDOW_MINUTES = 15
PRO_ALLOWED_OBSERVATION_WINDOWS = {5, 15}


def project_can_customize_observation_window(project: Project) -> bool:
    return project.plan == "pro"


def resolve_project_observation_window_minutes(project: Project) -> int:
    if not project_can_customize_observation_window(project):
        return FREE_OBSERVATION_WINDOW_MINUTES

    configured_window = getattr(project, "observation_window_minutes", None)
    if configured_window in PRO_ALLOWED_OBSERVATION_WINDOWS:
        return int(configured_window)

    return PRO_DEFAULT_OBSERVATION_WINDOW_MINUTES
