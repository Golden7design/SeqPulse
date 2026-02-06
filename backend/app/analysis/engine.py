from statistics import mean
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from uuid import UUID
from datetime import datetime, timezone
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment_verdict import DeploymentVerdict
from app.analysis.constants import ABSOLUTE_THRESHOLDS, MIN_TRAFFIC_THRESHOLD
from app.analysis.sdh import generate_sdh_hints


def analyze_deployment(deployment_id: UUID, db: Session) -> bool:
    """
    Analyse un déploiement terminé et génère un verdict.
    Compare les métriques POST (moyenne sur 5 min) :
    - aux seuils industriels (toujours)
    - à la baseline PRE (si trafic significatif)
    """
    deployment = db.query(Deployment).filter(
        Deployment.id == deployment_id,
        Deployment.state == "finished"
    ).first()

    if not deployment:
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
        created = _create_verdict(
            db=db,
            deployment_id=deployment_id,
            verdict="attention",
            confidence=0.4,
            summary="Insufficient metrics to assess deployment health",
            details=[]
        )
        deployment.state = "analyzed"
        db.commit()
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
        verdict, confidence, summary = "attention", 0.7, "Potential performance degradation detected"
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

    deployment.state = "analyzed"
    db.commit()
    return True


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
