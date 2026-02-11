# app/deployments/routes.py
from fastapi import APIRouter, Depends, Request, Header, Response
from sqlalchemy.orm import Session
from typing import Optional

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
from app.core.rate_limit import limiter, RATE_LIMITS

router = APIRouter(prefix="/deployments", tags=["deployments"])



# CI/CD ENDPOINTS (API Key)

@router.post("/trigger", response_model=DeploymentTriggerResponse)
@limiter.limit(RATE_LIMITS["deployments"])
def trigger_deployment(
    request: Request,
    response: Response,
    payload: DeploymentTriggerRequest,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return trigger_deployment_flow(
        db=db,
        project=project,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.post("/finish", response_model=DeploymentFinishResponse)
@limiter.limit(RATE_LIMITS["deployments"])
def finish_deployment(
    request: Request,
    response: Response,
    payload: DeploymentFinishRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return finish_deployment_flow(
        db=db,
        project=project,
        payload=payload,
    )
