from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
from uuid import UUID
from app.services.scheduler import schedule_analysis
from app.db.models.deployment_verdict import DeploymentVerdict
from app.auth.deps import get_current_user
from app.db.models.user import User
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.project import Project
from .schemas import (
    DeploymentTriggerRequest,
    DeploymentTriggerResponse,
    DeploymentFinishRequest,
    DeploymentFinishResponse,
    MetricsBatchRequest,
    MetricsBatchResponse,
    DeploymentVerdictResponse,
    DeploymentDetailOut,
    MetricSampleOut
)
from app.deployments.deps import get_project_by_api_key  # utilise X-API-Key


router = APIRouter(prefix="/deployments", tags=["deployments"])


# GET /deployments/{deployment_id}
@router.get("/{deployment_id}", response_model=DeploymentDetailOut)
def get_deployment_detail(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deployment = (
        db.query(Deployment)
        .join(Project)
        .options(joinedload(Deployment.metric_samples))  # ← eager load
        .filter(
            Deployment.id == deployment_id,
            Project.owner_id == current_user.id
        )
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


# GET /deployments/{deployment_id}/verdict
@router.get("/{deployment_id}/verdict", response_model=DeploymentVerdictResponse)
def get_deployment_verdict(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verdict = db.query(DeploymentVerdict).join(Deployment).join(Project).filter(
        DeploymentVerdict.deployment_id == deployment_id,
        Project.owner_id == current_user.id
    ).first()
    if not verdict:
        raise HTTPException(404, "Verdict not found")
    return verdict
# ────────────────
# MACHINE-FACING (API Key)
# ────────────────

@router.post("/trigger", response_model=DeploymentTriggerResponse)
def trigger_deployment(
    trigger_in: DeploymentTriggerRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db)
):
    """Démarre un nouveau déploiement."""
    # Vérifier qu'aucun déploiement n'est déjà en cours pour cet env
    existing = db.query(Deployment).filter(
        Deployment.project_id == project.id,
        Deployment.env == trigger_in.env,
        Deployment.status == "running"
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A deployment is already running for this environment"
        )

    deployment = Deployment(
        project_id=project.id,
        env=trigger_in.env,
        status="running"
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    
    return DeploymentTriggerResponse(deployment_id=deployment.id)


@router.post("/finish", response_model=DeploymentFinishResponse)
def finish_deployment(
    finish_in: DeploymentFinishRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db)
):
    """Termine un déploiement (succès ou échec)."""
    deployment = db.query(Deployment).filter(
        Deployment.id == finish_in.deployment_id,
        Deployment.project_id == project.id,
        Deployment.status == "running"
    ).first()
    
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Running deployment not found"
        )

    # Mettre à jour le statut et les timestamps
    deployment.status = finish_in.result
    deployment.finished_at = datetime.now(timezone.utc)
    
    if deployment.started_at:
        duration_sec = (deployment.finished_at - deployment.started_at).total_seconds()
        deployment.duration_ms = int(duration_sec * 1000)

    db.commit()
    db.refresh(deployment)
    # Planifier l'analyse des métriques après un délai (ex: 15 minutes)
    schedule_analysis(deployment.id, delay_minutes=1)

    
    
    return DeploymentFinishResponse(
        deployment_id=deployment.id,
        status=deployment.status
    )


@router.post("/metrics", response_model=MetricsBatchResponse)
def receive_metrics_batch(
    metrics_in: MetricsBatchRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db)
):
    """Reçoit un batch de métriques (PRE ou POST)."""
    # Valider le déploiement
    deployment = db.query(Deployment).filter(
        Deployment.id == metrics_in.deployment_id,
        Deployment.project_id == project.id
    ).first()
    
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deployment_id"
        )

    # Vérifier que le déploiement accepte encore des métriques
    if deployment.status not in ["running", "success", "failed"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deployment no longer accepting metrics"
        )

    # Stocker chaque métrique
    samples = []
    for name, value in metrics_in.metrics.items():
        sample = MetricSample(
            deployment_id=metrics_in.deployment_id,
            name=name,
            value=value,
            window=metrics_in.window
        )
        samples.append(sample)
        db.add(sample)

    db.commit()
    
    return MetricsBatchResponse(received=len(samples))