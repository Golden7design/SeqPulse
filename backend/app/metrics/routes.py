# app/metrics/routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.deployments.deps import get_project_by_api_key
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment import Deployment
from app.metrics.schemas import MetricCreate

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.post("")
def ingest_metric(
    metric_in: MetricCreate,
    project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db)
):
    deployment = (
        db.query(Deployment)
        .filter(Deployment.id == metric_in.deployment_id)
        .filter(Deployment.project_id == project.id)
        .first()
    )

    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment introuvable")

    # Déterminer PRE / POST automatiquement
    window = "pre" if deployment.status == "running" else "post"

    metric = MetricSample(
        deployment_id=deployment.id,
        name=metric_in.name,
        value=metric_in.value,
        window=window
    )

    db.add(metric)
    db.commit()

    return {"status": "ok"}
