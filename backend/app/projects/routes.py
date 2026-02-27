# app/projects/routes.py
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from typing import Dict, List
from uuid import uuid4

from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.core.public_ids import (
    format_deployment_public_id,
    parse_project_identifier,
)
from app.projects.schemas import (
    ProjectCreate,
    ProjectPublicOut,
    ProjectHmacSecret,
    ProjectDashboardOut,
    ProjectLastDeploymentOut,
    ProjectStatsOut,
    ProjectObservationWindowOut,
    ProjectObservationWindowUpdate,
    ProjectSlackConfigOut,
    ProjectSlackConfigUpdate,
    ProjectSlackTestMessageRequest,
    ProjectSlackTestMessageOut,
    ProjectEndpointUpdate,
    ProjectEndpointOut,
)
from app.projects.observation import (
    FREE_OBSERVATION_WINDOW_MINUTES,
    project_can_customize_observation_window,
    resolve_project_observation_window_minutes,
)
from app.projects.endpoint_lock import (
    append_project_endpoint_event,
    build_project_endpoint_view,
    normalize_endpoint_or_raise,
    test_and_activate_project_endpoint_candidate,
    update_project_endpoint_candidate,
)
from app.projects.utils import generate_api_key, generate_hmac_secret
from app.slack.service import send_slack_if_not_sent
from app.slack.types import SLACK_TYPE_TEST_MESSAGE

router = APIRouter(prefix="/projects", tags=["projects"])
_ENDPOINT_REAUTH_MAX_AGE_MINUTES = 15

@router.post("/", response_model=ProjectPublicOut)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    normalized_candidate = normalize_endpoint_or_raise(str(project_in.metrics_endpoint))
    project = Project(
        name=project_in.name,
        description=project_in.description,
        tech_stack=project_in.tech_stack,
        plan=project_in.plan,
        owner_id=current_user.id,
        envs=project_in.envs,
        api_key=generate_api_key(),
        hmac_secret=generate_hmac_secret(),  # stocké, mais pas retourné
        metrics_endpoint_candidate=normalized_candidate,
        endpoint_state="pending_verification",
    )
    db.add(project)
    db.flush()
    append_project_endpoint_event(
        db=db,
        project=project,
        event_type="endpoint_candidate_updated",
        actor_user_id=current_user.id,
        payload={"mutation": "none", "source": "project_create"},
    )
    db.commit()
    db.refresh(project)
    return _to_project_public_out(project)


@router.get("/", response_model=List[ProjectDashboardOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    if not projects:
        return []

    project_ids = [project.id for project in projects]
    deployments = (
        db.query(Deployment)
        .options(joinedload(Deployment.verdict))
        .filter(Deployment.project_id.in_(project_ids))
        .all()
    )

    deployments_by_project: Dict[str, List[Deployment]] = defaultdict(list)
    for deployment in deployments:
        deployments_by_project[str(deployment.project_id)].append(deployment)

    return [
        _build_project_dashboard_out(
            project=project,
            project_deployments=deployments_by_project.get(str(project.id), []),
        )
        for project in projects
    ]


@router.get("/{project_id}", response_model=ProjectDashboardOut)
def get_project_dashboard(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deployments = (
        db.query(Deployment)
        .options(joinedload(Deployment.verdict))
        .filter(Deployment.project_id == project.id)
        .all()
    )
    return _build_project_dashboard_out(project=project, project_deployments=deployments)


@router.get("/{project_id}/public", response_model=ProjectPublicOut)
def get_project_public(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_project_public_out(project)


@router.get("/{project_id}/endpoint", response_model=ProjectEndpointOut)
def get_project_endpoint(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectEndpointOut(**build_project_endpoint_view(project))


@router.put("/{project_id}/endpoint", response_model=ProjectEndpointOut)
def update_project_endpoint(
    project_id: str,
    payload: ProjectEndpointUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_by_identifier(db=db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_project_endpoint_mutation_permissions(current_user=current_user, project=project)

    updated = update_project_endpoint_candidate(
        db=db,
        project=project,
        endpoint=str(payload.metrics_endpoint),
        actor_user_id=current_user.id,
    )
    return ProjectEndpointOut(**build_project_endpoint_view(updated))


@router.post("/{project_id}/endpoint/test", response_model=ProjectEndpointOut)
def test_project_endpoint(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_by_identifier(db=db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_project_endpoint_mutation_permissions(current_user=current_user, project=project)

    updated = test_and_activate_project_endpoint_candidate(
        db=db,
        project=project,
        actor_user_id=current_user.id,
    )
    return ProjectEndpointOut(**build_project_endpoint_view(updated))


@router.post("/{project_id}/hmac/enable", response_model=ProjectHmacSecret)
def enable_hmac_and_reveal_secret(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.hmac_enabled:
        raise HTTPException(status_code=400, detail="HMAC already enabled")

    # (Re)génère un secret HMAC à chaque activation
    project.hmac_secret = generate_hmac_secret()
    # Active HMAC
    project.hmac_enabled = True
    db.commit()

    # Révèle le secret UNE SEULE FOIS
    return ProjectHmacSecret(hmac_secret=project.hmac_secret)

@router.post("/{project_id}/hmac/disable", response_model=ProjectPublicOut)
def disable_hmac(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.hmac_enabled = False
    db.commit()
    db.refresh(project)
    return _to_project_public_out(project)

@router.post("/{project_id}/hmac/rotate", response_model=ProjectHmacSecret)
def rotate_hmac_secret(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.hmac_enabled:
        raise HTTPException(status_code=400, detail="HMAC not enabled")

    project.hmac_secret = generate_hmac_secret()
    db.commit()

    return ProjectHmacSecret(hmac_secret=project.hmac_secret)


@router.get("/{project_id}/observation-window", response_model=ProjectObservationWindowOut)
def get_project_observation_window(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_project_observation_window_out(project)


@router.put("/{project_id}/observation-window", response_model=ProjectObservationWindowOut)
def update_project_observation_window(
    project_id: str,
    payload: ProjectObservationWindowUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_can_customize_observation_window(project):
        project.observation_window_minutes = payload.observation_window_minutes
    elif payload.observation_window_minutes != FREE_OBSERVATION_WINDOW_MINUTES:
        raise HTTPException(
            status_code=403,
            detail="Free projects are locked to a 5-minute observation window.",
        )
    else:
        # Keep free projects on implicit default so a future Pro upgrade starts at 15 min.
        project.observation_window_minutes = None

    db.commit()
    db.refresh(project)
    return _to_project_observation_window_out(project)


@router.get("/{project_id}/slack", response_model=ProjectSlackConfigOut)
def get_project_slack_config(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_project_slack_config_out(project)


@router.put("/{project_id}/slack", response_model=ProjectSlackConfigOut)
def update_project_slack_config(
    project_id: str,
    payload: ProjectSlackConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    normalized_webhook_url = (payload.webhook_url or "").strip()
    normalized_channel = (payload.channel or "").strip()

    if payload.enabled and project.plan != "pro":
        raise HTTPException(
            status_code=403,
            detail="Slack integration is available only for Pro projects.",
        )

    if payload.webhook_url is not None:
        project.slack_webhook_url = normalized_webhook_url or None
    if payload.channel is not None:
        project.slack_channel = normalized_channel or None

    if payload.enabled and not (project.slack_webhook_url or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Slack webhook URL is required to enable Slack integration.",
        )

    project.slack_enabled = payload.enabled
    db.commit()
    db.refresh(project)
    return _to_project_slack_config_out(project)


@router.post("/{project_id}/slack/test", response_model=ProjectSlackTestMessageOut)
def send_project_slack_test_message(
    project_id: str,
    payload: ProjectSlackTestMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _find_project_for_user(db=db, current_user=current_user, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.plan != "pro":
        raise HTTPException(
            status_code=403,
            detail="Slack integration is available only for Pro projects.",
        )
    if not project.slack_enabled:
        raise HTTPException(status_code=400, detail="Slack integration is not enabled for this project.")
    if not (project.slack_webhook_url or "").strip():
        raise HTTPException(status_code=400, detail="Slack webhook URL is missing for this project.")

    default_message = (
        f"SeqPulse test notification for project '{project.name}' "
        f"({project.envs[0] if project.envs else 'prod'})."
    )
    result = send_slack_if_not_sent(
        db=db,
        user_id=current_user.id,
        project_id=project.id,
        notification_type=SLACK_TYPE_TEST_MESSAGE,
        dedupe_key=f"slack_test:{project.id}:{uuid4()}",
        message_text=(payload.message or "").strip() or default_message,
    )

    if result.status == "failed":
        raise HTTPException(status_code=502, detail=result.reason or "Slack send failed")
    return ProjectSlackTestMessageOut(status=result.status, reason=result.reason)


def _build_project_dashboard_out(project: Project, project_deployments: List[Deployment]) -> ProjectDashboardOut:
    counters = {
        "ok": 0,
        "warning": 0,
        "rollback_recommended": 0,
    }
    for deployment in project_deployments:
        counters[_normalized_project_verdict(deployment)] += 1

    fallback_time = project.created_at or datetime.now(timezone.utc)
    latest_deployment = _latest_deployment(project_deployments)

    if latest_deployment:
        deployment_number = int(latest_deployment.deployment_number or 0)
        last_deployment = ProjectLastDeploymentOut(
            id=format_deployment_public_id(deployment_number) if deployment_number > 0 else "",
            deployment_number=deployment_number,
            verdict=_normalized_project_verdict(latest_deployment),
            finished_at=latest_deployment.finished_at or latest_deployment.started_at or fallback_time,
        )
    else:
        last_deployment = ProjectLastDeploymentOut(
            id="",
            deployment_number=0,
            verdict="ok",
            finished_at=fallback_time,
        )

    return ProjectDashboardOut(
        id=str(project.id),
        internal_id=str(project.id),
        name=project.name,
        env=_primary_env(project),
        plan=project.plan,
        hmac_enabled=project.hmac_enabled,
        stack=_parse_stack(project.tech_stack),
        last_deployment=last_deployment,
        stats=ProjectStatsOut(
            deployments_total=len(project_deployments),
            ok_count=counters["ok"],
            warning_count=counters["warning"],
            rollback_count=counters["rollback_recommended"],
        ),
        created_at=fallback_time,
    )


def _latest_deployment(deployments: List[Deployment]) -> Deployment | None:
    if not deployments:
        return None
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    return max(
        deployments,
        key=lambda deployment: deployment.finished_at or deployment.started_at or epoch,
    )


def _normalized_project_verdict(deployment: Deployment) -> str:
    if deployment.verdict and deployment.verdict.verdict in {"ok", "warning", "rollback_recommended"}:
        return deployment.verdict.verdict
    if deployment.verdict and deployment.verdict.verdict == "attention":
        return "warning"
    if deployment.pipeline_result == "failed":
        return "rollback_recommended"
    return "ok"


def _primary_env(project: Project) -> str:
    if project.envs and len(project.envs) > 0:
        return str(project.envs[0])
    return "prod"


def _parse_stack(tech_stack: str | None) -> List[str]:
    if not tech_stack:
        return []
    if "," in tech_stack:
        items = [item.strip() for item in tech_stack.split(",")]
    else:
        items = [tech_stack.strip()]
    return [item for item in items if item]


def _to_project_public_out(project: Project) -> ProjectPublicOut:
    return ProjectPublicOut(
        id=str(project.id),
        internal_id=str(project.id),
        name=project.name,
        description=project.description,
        tech_stack=project.tech_stack,
        api_key=project.api_key,
        envs=project.envs or [],
        hmac_enabled=project.hmac_enabled,
    )


def _to_project_slack_config_out(project: Project) -> ProjectSlackConfigOut:
    webhook = (project.slack_webhook_url or "").strip()
    preview = _mask_webhook_url(webhook) if webhook else None
    return ProjectSlackConfigOut(
        enabled=bool(project.slack_enabled),
        webhook_url_configured=bool(webhook),
        webhook_url_preview=preview,
        channel=project.slack_channel,
        plan=project.plan,
    )


def _to_project_observation_window_out(project: Project) -> ProjectObservationWindowOut:
    return ProjectObservationWindowOut(
        observation_window_minutes=resolve_project_observation_window_minutes(project),
        editable=project_can_customize_observation_window(project),
        plan=project.plan,
    )


def _mask_webhook_url(url: str) -> str:
    if len(url) <= 16:
        return "********"
    return f"{url[:16]}...{url[-6:]}"


def _find_project_for_user(db: Session, current_user: User, project_id: str) -> Project | None:
    project = _find_project_by_identifier(db=db, project_id=project_id)
    if not project:
        return None
    if bool(getattr(current_user, "is_superuser", False)):
        return project
    if project.owner_id == current_user.id:
        return project
    return None


def _find_project_by_identifier(db: Session, project_id: str) -> Project | None:
    try:
        identifier_value = parse_project_identifier(project_id)
    except ValueError:
        return None

    return (
        db.query(Project)
        .filter(Project.id == identifier_value)
        .first()
    )


def _assert_project_endpoint_mutation_permissions(*, current_user: User, project: Project) -> None:
    is_owner = project.owner_id == current_user.id
    is_admin = bool(getattr(current_user, "is_superuser", False))
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="INSUFFICIENT_ROLE")
    _assert_recent_reauth(current_user=current_user)


def _assert_recent_reauth(*, current_user: User) -> None:
    # Pragmatic guard: for users with 2FA enabled, require a recent 2FA verification
    # before sensitive endpoint-lock mutations.
    if not bool(getattr(current_user, "twofa_enabled", False)):
        return

    last_verified_at = getattr(current_user, "twofa_last_verified_at", None)
    if last_verified_at is None:
        raise HTTPException(status_code=401, detail="REAUTH_REQUIRED")

    if last_verified_at.tzinfo is None:
        last_verified_at = last_verified_at.replace(tzinfo=timezone.utc)

    max_age = timedelta(minutes=_ENDPOINT_REAUTH_MAX_AGE_MINUTES)
    if datetime.now(timezone.utc) - last_verified_at > max_age:
        raise HTTPException(status_code=401, detail="REAUTH_REQUIRED")
