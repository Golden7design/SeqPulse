# app/deployments/services.py
from fastapi import HTTPException
import logging
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.models.deployment import Deployment
from app.scheduler.tasks import schedule_pre_collection, schedule_post_collection, schedule_analysis
from app.scheduler.config import PLAN_OBSERVATION_WINDOWS, PLAN_ANALYSIS_DELAYS

logger = logging.getLogger(__name__)

def trigger_deployment_flow(db: Session, project, payload):
    if payload.env not in project.envs:
        raise HTTPException(status_code=400, detail=f"Environment '{payload.env}' not allowed")

    deployment = Deployment(
        project_id=project.id,
        env=payload.env,
        state="running",
        started_at=datetime.now(timezone.utc)
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    logger.info(
        "deployment_triggered deployment_id=%s project_id=%s env=%s metrics_endpoint=%s",
        str(deployment.id),
        str(project.id),
        payload.env,
        str(payload.metrics_endpoint) if payload.metrics_endpoint else None,
    )

    if payload.metrics_endpoint:
        schedule_pre_collection(
            db=db,
            deployment_id=deployment.id,
            metrics_endpoint=str(payload.metrics_endpoint),
            use_hmac=project.hmac_enabled,
            hmac_secret=project.hmac_secret,
            project_id=project.id,
        )

    return {
        "deployment_id": deployment.id,
        "status": "running",
    }

def finish_deployment_flow(db: Session, project, payload):
    deployment = db.query(Deployment).filter(
        Deployment.id == payload.deployment_id,
        Deployment.project_id == project.id,
    ).first()

    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    finished_at = datetime.now(timezone.utc)
    deployment.pipeline_result = payload.result
    deployment.state = "finished"
    deployment.finished_at = finished_at

    if deployment.started_at:
        duration_sec = (finished_at - deployment.started_at).total_seconds()
        deployment.duration_ms = int(duration_sec * 1000)

    db.commit()

    # 🔹 Calculer les durées DYNAMIQUEMENT
    window = PLAN_OBSERVATION_WINDOWS.get(project.plan, 5)
    delay = PLAN_ANALYSIS_DELAYS.get(project.plan, 5)

    logger.info(
        "deployment_finished deployment_id=%s project_id=%s result=%s plan=%s window=%s delay=%s metrics_endpoint=%s",
        str(deployment.id),
        str(project.id),
        payload.result,
        project.plan,
        window,
        delay,
        str(payload.metrics_endpoint) if payload.metrics_endpoint else None,
    )

    if payload.metrics_endpoint:
        schedule_post_collection(
            db=db,
            deployment_id=deployment.id,
            metrics_endpoint=str(payload.metrics_endpoint),
            use_hmac=project.hmac_enabled,
            hmac_secret=project.hmac_secret,
            project_id=project.id,
            observation_window=window  # ← passé ici
        )

    schedule_analysis(
        db=db,
        deployment_id=deployment.id,
        delay_minutes=delay  # ← dynamique
    )

    return {
        "status": "accepted",
        "message": f"Deployment finished. Analysis scheduled in {delay} minutes."
    }
