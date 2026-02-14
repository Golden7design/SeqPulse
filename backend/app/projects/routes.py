# app/projects/routes.py
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from typing import Dict, List

from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.core.public_ids import (
    format_project_public_id,
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
)
from app.projects.utils import generate_api_key, generate_hmac_secret

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectPublicOut)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = Project(
        name=project_in.name,
        description=project_in.description,
        tech_stack=project_in.tech_stack,
        owner_id=current_user.id,
        envs=project_in.envs,
        api_key=generate_api_key(),
        hmac_secret=generate_hmac_secret(),  # stocké, mais pas retourné
    )
    db.add(project)
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

    project_number = int(project.project_number or 0)
    return ProjectDashboardOut(
        id=format_project_public_id(project_number) if project_number > 0 else "",
        internal_id=str(project.id),
        project_number=project_number,
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
    project_number = int(project.project_number or 0)
    return ProjectPublicOut(
        id=format_project_public_id(project_number) if project_number > 0 else "",
        internal_id=str(project.id),
        project_number=project_number,
        name=project.name,
        description=project.description,
        tech_stack=project.tech_stack,
        api_key=project.api_key,
        envs=project.envs or [],
        hmac_enabled=project.hmac_enabled,
    )


def _find_project_for_user(db: Session, current_user: User, project_id: str) -> Project | None:
    try:
        identifier_type, identifier_value = parse_project_identifier(project_id)
    except ValueError:
        return None

    query = db.query(Project).filter(Project.owner_id == current_user.id)
    if identifier_type == "number":
        query = query.filter(Project.project_number == identifier_value)
    else:
        query = query.filter(Project.id == identifier_value)
    return query.first()
