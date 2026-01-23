# app/deployments/services.py
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.models.deployment import Deployment
from app.scheduler.tasks import schedule_post_collection, schedule_analysis
from app.metrics.collector import collect_metrics
from app.scheduler.config import PLAN_OBSERVATION_WINDOWS, PLAN_ANALYSIS_DELAYS

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

    if payload.metrics_endpoint:
        try:
            collect_metrics(
                deployment_id=deployment.id,
                phase="pre",
                metrics_endpoint=str(payload.metrics_endpoint),
                db=db,
                use_hmac=project.hmac_enabled,
                secret=project.hmac_secret,
            )
        except Exception:
            deployment.state = "pre_metrics_failed"
            db.commit()

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

    if payload.metrics_endpoint:
        schedule_post_collection(
            deployment_id=deployment.id,
            metrics_endpoint=str(payload.metrics_endpoint),
            project=project,
            observation_window=window  # ← passé ici
        )

    schedule_analysis(
        deployment_id=deployment.id,
        delay_minutes=delay  # ← dynamique
    )

    return {
        "status": "accepted",
        "message": f"Deployment finished. Analysis scheduled in {delay} minutes."
    }