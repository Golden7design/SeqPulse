# app/deployments/services.py
from fastapi import HTTPException
import logging
from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
from app.db.models.deployment import Deployment
from app.scheduler.tasks import schedule_pre_collection, schedule_post_collection, schedule_analysis
from app.scheduler.config import PLAN_OBSERVATION_WINDOWS, PLAN_ANALYSIS_DELAYS

logger = logging.getLogger(__name__)

def trigger_deployment_flow(db: Session, project, payload, idempotency_key: Optional[str] = None):
    if payload.env not in project.envs:
        raise HTTPException(status_code=400, detail=f"Environment '{payload.env}' not allowed")

    # Priorité: Idempotency-Key
    key = idempotency_key or payload.idempotency_key
    if key is not None:
        key = key.strip()
        if not key:
            key = None
    if key:
        existing = db.query(Deployment).filter(
            Deployment.idempotency_key == key
        ).first()
        if existing:
            logger.info(
                "deployment_idempotent_hit deployment_id=%s project_id=%s env=%s idempotency_key=%s",
                str(existing.id),
                str(project.id),
                existing.env,
                key,
            )
            return {
                "deployment_id": existing.id,
                "status": "existing",
                "message": "Deployment already exists for this idempotency key",
            }

    # Un seul deployment running par (project, env)
    running = db.query(Deployment).filter(
        Deployment.project_id == project.id,
        Deployment.env == payload.env,
        Deployment.state == "running",
    ).first()

    if running:
        logger.info(
            "deployment_running_exists deployment_id=%s project_id=%s env=%s",
            str(running.id),
            str(project.id),
            payload.env,
        )
        return {
            "deployment_id": running.id,
            "status": "existing",
            "message": "Deployment already running for this environment",
        }

    # Créer nouveau déploiement
    deployment = Deployment(
        project_id=project.id,
        env=payload.env,
        idempotency_key=key,
        branch=payload.branch,
        state="running",
        started_at=datetime.now(timezone.utc)
    )
    
    try:
        db.add(deployment)
        db.commit()
        db.refresh(deployment)
    except IntegrityError as e:
        # Contrainte unique violée (race condition entre requêtes concurrentes)
        db.rollback()
        logger.warning(
            "deployment_integrity_error project_id=%s env=%s idempotency_key=%s error=%s",
            str(project.id),
            payload.env,
            key,
            str(e)
        )
        # Récupérer le déploiement existant (par clé ou running)
        if key:
            existing = db.query(Deployment).filter(
                Deployment.idempotency_key == key
            ).first()
            if existing:
                return {
                    "deployment_id": existing.id,
                    "status": "existing",
                    "message": "Deployment already exists for this idempotency key",
                }
        running = db.query(Deployment).filter(
            Deployment.project_id == project.id,
            Deployment.env == payload.env,
            Deployment.state == "running",
        ).first()
        if running:
            return {
                "deployment_id": running.id,
                "status": "existing",
                "message": "Deployment already running for this environment",
            }
        raise

    logger.info(
        "deployment_created deployment_id=%s project_id=%s env=%s idempotency_key=%s branch=%s metrics_endpoint=%s",
        str(deployment.id),
        str(project.id),
        payload.env,
        key,
        payload.branch or "N/A",
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
        "status": "created",
    }

def finish_deployment_flow(db: Session, project, payload):
    deployment = db.query(Deployment).filter(
        Deployment.id == payload.deployment_id,
        Deployment.project_id == project.id,
    ).first()

    if not deployment:
        return {
            "status": "not_found",
            "message": "Deployment not found",
        }

    # Déjà terminé ? → no-op idempotent
    if deployment.state != "running":
        return {
            "status": "ignored",
            "message": f"Deployment state is '{deployment.state}', finish ignored",
        }

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
