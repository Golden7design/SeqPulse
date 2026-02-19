import time
from statistics import mean
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, timezone
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment_verdict import DeploymentVerdict
from app.analysis.constants import ABSOLUTE_THRESHOLDS, MIN_TRAFFIC_THRESHOLD
from app.analysis.sdh import generate_sdh_hints
from app.email.types import EMAIL_TYPE_CRITICAL_VERDICT_ALERT, EMAIL_TYPE_FIRST_VERDICT_AVAILABLE
from app.observability.metrics import observe_analysis_duration
from app.scheduler.tasks import schedule_email
import structlog

logger = structlog.get_logger(__name__)


def analyze_deployment(deployment_id: UUID, db: Session) -> bool:
    """
    Analyse un déploiement terminé et génère un verdict.
    Compare les métriques POST (moyenne sur 5 min) :
    - aux seuils industriels (toujours)
    - à la baseline PRE (si trafic significatif)
    """
    started_at = time.perf_counter()
    outcome = "error"
    try:
        deployment = db.query(Deployment).filter(
            Deployment.id == deployment_id,
            Deployment.state == "finished"
        ).first()

        if not deployment:
            outcome = "not_found"
            return False

        # Récupérer les métriques
        pre_samples = db.query(MetricSample).filter_by(
            deployment_id=deployment_id, phase="pre"
        ).all()
        
        post_samples = db.query(MetricSample).filter_by(
            deployment_id=deployment_id, phase="post"
        ).all()

        # Cas : données insuffisantes
        if not pre_samples or not post_samples:
            _create_verdict(
                db=db,
                deployment_id=deployment_id,
                verdict="warning",
                confidence=0.4,
                summary="Insufficient metrics to assess deployment health",
                details=[]
            )
            deployment.state = "analyzed"
            db.commit()
            outcome = "insufficient_data"
            return True

        # Agréger les métriques POST (moyenne sur 5 échantillons)
        post_agg = {
            "latency_p95": mean(s.latency_p95 for s in post_samples),
            "error_rate": mean(s.error_rate for s in post_samples),
            "cpu_usage": mean(s.cpu_usage for s in post_samples),
            "memory_usage": mean(s.memory_usage for s in post_samples),
            "requests_per_sec": mean(s.requests_per_sec for s in post_samples),
        }

        # Baseline PRE = premier échantillon
        pre = pre_samples[0]
        pre_agg = {
            "latency_p95": pre.latency_p95,
            "error_rate": pre.error_rate,
            "cpu_usage": pre.cpu_usage,
            "memory_usage": pre.memory_usage,
            "requests_per_sec": pre.requests_per_sec,
        }

        flags = []

        # 🔹 1. Vérification des seuils ABSOLUS (toujours active)
        if post_agg["latency_p95"] > ABSOLUTE_THRESHOLDS["latency_p95"]:
            flags.append("latency_p95 > 300ms")
        if post_agg["error_rate"] > ABSOLUTE_THRESHOLDS["error_rate"]:
            flags.append("error_rate > 1%")
        if post_agg["cpu_usage"] > ABSOLUTE_THRESHOLDS["cpu_usage"]:
            flags.append("cpu_usage > 80%")
        if post_agg["memory_usage"] > ABSOLUTE_THRESHOLDS["memory_usage"]:
            flags.append("memory_usage > 85%")

        # 2. Vérification relative (seulement si trafic significatif en PRE)
        if pre_agg["requests_per_sec"] >= MIN_TRAFFIC_THRESHOLD:
            if post_agg["latency_p95"] > pre_agg["latency_p95"] * 1.3:
                flags.append("latency_p95 increased >30% vs PRE")
            if post_agg["error_rate"] > pre_agg["error_rate"] * 1.5:
                flags.append("error_rate increased >50% vs PRE")
            if post_agg["requests_per_sec"] < pre_agg["requests_per_sec"] * 0.6:
                flags.append("traffic dropped >40% vs PRE")

        # 3. Générer le verdict final
        if not flags:
            verdict, confidence, summary = "ok", 0.9, "No significant regression detected"
        elif len(flags) == 1:
            verdict, confidence, summary = "warning", 0.7, "Potential performance degradation detected"
        else:
            verdict, confidence, summary = "rollback_recommended", 0.85, "Multiple critical regressions detected"

        created = _create_verdict(db, deployment_id, verdict, confidence, summary, flags)

        created_at = max((s.collected_at for s in post_samples), default=None)
        if not created_at:
            created_at = datetime.now(timezone.utc)
        if created:
            generate_sdh_hints(
                db=db,
                deployment=deployment,
                pre_agg=pre_agg,
                post_agg=post_agg,
                created_at=created_at,
            )
            _schedule_verdict_lifecycle_emails(
                db=db,
                deployment=deployment,
                verdict=verdict,
            )

        deployment.state = "analyzed"
        db.commit()
        outcome = verdict
        return True
    finally:
        observe_analysis_duration(
            duration_seconds=time.perf_counter() - started_at,
            outcome=outcome,
        )


def _create_verdict(db, deployment_id, verdict, confidence, summary, details) -> bool:
    """Crée un verdict dans la base (idempotent).

    Retourne True si un verdict a été créé, False s'il existait déjà.
    """
    stmt = (
        insert(DeploymentVerdict)
        .values(
            deployment_id=deployment_id,
            verdict=verdict,
            confidence=confidence,
            summary=summary,
            details=details,
        )
        .on_conflict_do_nothing(index_elements=["deployment_id"])
        .returning(DeploymentVerdict.id)
    )
    result = db.execute(stmt)
    created_id = result.scalar()
    db.commit()
    return created_id is not None


def _schedule_verdict_lifecycle_emails(db: Session, *, deployment: Deployment, verdict: str) -> None:
    project = getattr(deployment, "project", None)
    owner = getattr(project, "owner", None) if project else None
    if owner is None or not owner.email:
        logger.warning(
            "verdict_email_schedule_skipped",
            deployment_id=str(deployment.id),
            reason="missing_owner_or_email",
        )
        return

    first_name = _extract_first_name(owner.name, owner.email)
    context: dict[str, Any] = {
        "first_name": first_name,
        "project_name": project.name if project and project.name else "your project",
        "verdict": verdict,
        "deployment_number": deployment.deployment_number,
        "env": deployment.env,
    }

    if _is_first_project_verdict(db, deployment.project_id):
        try:
            schedule_email(
                db,
                user_id=owner.id,
                to_email=owner.email,
                email_type=EMAIL_TYPE_FIRST_VERDICT_AVAILABLE,
                dedupe_key=f"first_verdict_available:{deployment.project_id}",
                project_id=deployment.project_id,
                context=context,
            )
        except Exception as exc:
            logger.warning(
                "first_verdict_email_schedule_failed",
                deployment_id=str(deployment.id),
                project_id=str(deployment.project_id),
                user_id=str(owner.id),
                error=str(exc),
            )

    if verdict in {"warning", "rollback_recommended"}:
        try:
            schedule_email(
                db,
                user_id=owner.id,
                to_email=owner.email,
                email_type=EMAIL_TYPE_CRITICAL_VERDICT_ALERT,
                dedupe_key=f"critical_verdict_alert:{deployment.id}",
                project_id=deployment.project_id,
                context=context,
                deployment_id=deployment.id,
            )
        except Exception as exc:
            logger.warning(
                "critical_verdict_email_schedule_failed",
                deployment_id=str(deployment.id),
                project_id=str(deployment.project_id),
                user_id=str(owner.id),
                verdict=verdict,
                error=str(exc),
            )


def _is_first_project_verdict(db: Session, project_id: UUID) -> bool:
    total_verdicts = (
        db.query(func.count(DeploymentVerdict.id))
        .join(Deployment, Deployment.id == DeploymentVerdict.deployment_id)
        .filter(Deployment.project_id == project_id)
        .scalar()
    )
    return int(total_verdicts or 0) == 1


def _extract_first_name(name: str | None, fallback_email: str) -> str:
    normalized = (name or "").strip()
    if normalized:
        return normalized.split(" ", maxsplit=1)[0][:50]
    return fallback_email.split("@", maxsplit=1)[0][:50] or "there"
