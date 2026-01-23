# app/deployments/routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.project import Project
from app.deployments.schemas import (
    DeploymentTriggerRequest,
    DeploymentTriggerResponse,
    DeploymentFinishRequest,
    DeploymentFinishResponse,
)
from app.deployments.deps import get_project_by_api_key
from app.deployments.services import (
    trigger_deployment_flow,
    finish_deployment_flow,
)

router = APIRouter(prefix="/deployments", tags=["deployments"])


# ─────────────────────────────────────────────
# CI/CD ENDPOINTS (API Key)
# ─────────────────────────────────────────────

@router.post("/trigger", response_model=DeploymentTriggerResponse)
def trigger_deployment(
    payload: DeploymentTriggerRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return trigger_deployment_flow(
        db=db,
        project=project,
        payload=payload,
    )


@router.post("/finish", response_model=DeploymentFinishResponse)
def finish_deployment(
    payload: DeploymentFinishRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return finish_deployment_flow(
        db=db,
        project=project,
        payload=payload,
    )
