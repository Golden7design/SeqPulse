# app/deployments/routes.py
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.deployment import Deployment
from app.db.models.project import Project
from app.deployments.schemas import DeploymentCreate, DeploymentOut, DeploymentUpdate
from app.deployments.deps import get_project_by_api_key
from sqlalchemy import func

router = APIRouter(prefix="/deployments", tags=["deployments"])


# User-facing

@router.get("/", response_model=List[DeploymentOut])
def list_user_deployments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deployments = (
        db.query(Deployment)
        .join(Project)
        .filter(Project.owner_id == current_user.id)
        .all()
    )
    return deployments


@router.get("/{deployment_id}", response_model=DeploymentOut)
def get_user_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deployment = (
        db.query(Deployment)
        .join(Project)
        .filter(Deployment.id == deployment_id)
        .filter(Project.owner_id == current_user.id)
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Déploiement introuvable")
    return deployment


# Machine-facing

@router.post("/trigger", response_model=DeploymentOut)
def trigger_deployment(
    project: Project = Depends(get_project_by_api_key),
    deployment_in: DeploymentCreate = Body(...),
    db: Session = Depends(get_db)
):
    deployment = Deployment(
        project_id=project.id,
        env=deployment_in.env,
        status="pending"
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    return deployment



@router.patch("/finish", response_model=DeploymentOut)
def finish_deployment(
    deployment_update: DeploymentUpdate,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db)
):
    # Récupérer le dernier déploiement pending
    deployment = (
        db.query(Deployment)
        .filter(Deployment.project_id == project.id)
        .filter(Deployment.status == "pending")
        .order_by(Deployment.start_time.desc())
        .first()
    )

    if not deployment:
        raise HTTPException(status_code=404, detail="Aucun déploiement pending trouvé")

    # Mettre à jour le status et end_time
    deployment.status = deployment_update.status
    deployment.end_time = deployment_update.end_time or func.now()

    db.commit()
    db.refresh(deployment)
    return deployment
