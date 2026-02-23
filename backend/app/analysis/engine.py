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
from app.analysis.constants import (
    INDUSTRIAL_THRESHOLDS,
    MIN_TRAFFIC_THRESHOLD,
    RPS_DROP_THRESHOLD,
    RPS_PERSISTENCE_TOLERANCE,
    SECURED_THRESHOLD_FACTOR,
    TOLERANCES,
)
from app.analysis.sdh import generate_sdh_hints
from app.email.types import EMAIL_TYPE_CRITICAL_VERDICT_ALERT, EMAIL_TYPE_FIRST_VERDICT_AVAILABLE
from app.observability.metrics import observe_analysis_duration
from app.scheduler.tasks import schedule_email, schedule_slack
from app.slack.types import (
    SLACK_TYPE_CRITICAL_VERDICT_ALERT,
    SLACK_TYPE_FIRST_VERDICT_AVAILABLE,
)
import structlog

logger = structlog.get_logger(__name__)


def analyze_deployment(deployment_id: UUID, db: Session) -> bool:
    """
    Analyse un déploiement terminé et génère un verdict.
    Compare les métriques POST par séquences :
    - seuil sécurisé (seuil industriel * facteur)
    - tolérance de dépassement par métrique
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

        # Agréger les métriques POST pour SDH (moyenne sur l'ensemble des séquences)
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

        total_sequences = len(post_samples)
        if total_sequences == 0:
            _create_verdict(
                db=db,
                deployment_id=deployment_id,
                verdict="warning",
                confidence=0.4,
                summary="Insufficient metrics to assess deployment health",
                details=[],
            )
            deployment.state = "analyzed"
            db.commit()
            outcome = "insufficient_data"
            return True

        secured_thresholds = {
            metric: INDUSTRIAL_THRESHOLDS[metric] * SECURED_THRESHOLD_FACTOR
            for metric in INDUSTRIAL_THRESHOLDS
        }

        def _ratio(count: int, total: int) -> float:
            if total <= 0:
                return 0.0
            return count / total

        # Vérification par métrique (ratio de dépassement vs tolérance)
        exceed_counts = {
            "latency_p95": 0,
            "error_rate": 0,
            "cpu_usage": 0,
            "memory_usage": 0,
            "requests_per_sec": 0,
        }

        pre_rps = pre_agg.get("requests_per_sec", 0.0)

        for sample in post_samples:
            if sample.latency_p95 > secured_thresholds["latency_p95"]:
                exceed_counts["latency_p95"] += 1
            if sample.error_rate > secured_thresholds["error_rate"]:
                exceed_counts["error_rate"] += 1
            if sample.cpu_usage > secured_thresholds["cpu_usage"]:
                exceed_counts["cpu_usage"] += 1
            if sample.memory_usage > secured_thresholds["memory_usage"]:
                exceed_counts["memory_usage"] += 1

            if pre_rps > 0:
                drop = (pre_rps - sample.requests_per_sec) / pre_rps
                if drop > RPS_DROP_THRESHOLD:
                    exceed_counts["requests_per_sec"] += 1

        exceed_ratios = {
            metric: _ratio(count, total_sequences)
            for metric, count in exceed_counts.items()
        }

        def _fmt_ratio(value: float) -> str:
            return f"{round(value * 100)}%"

        # Standard metrics
        for metric in ("latency_p95", "error_rate", "cpu_usage", "memory_usage"):
            ratio = exceed_ratios[metric]
            tolerance = TOLERANCES[metric]
            if ratio > tolerance:
                flags.append(
                    f"{metric} exceed_ratio {_fmt_ratio(ratio)} > {_fmt_ratio(tolerance)} "
                    f"(secured {secured_thresholds[metric]:.3g})"
                )

        # requests_per_sec special case (two thresholds)
        if pre_rps > 0:
            ratio = exceed_ratios["requests_per_sec"]
            if ratio > RPS_PERSISTENCE_TOLERANCE:
                flags.append(
                    "requests_per_sec drop_ratio "
                    f"{_fmt_ratio(ratio)} > {_fmt_ratio(RPS_PERSISTENCE_TOLERANCE)} "
                    f"(drop_threshold {int(RPS_DROP_THRESHOLD * 100)}%)"
                )

        failed_metrics = set()
        critical_metrics = {"error_rate", "requests_per_sec"}
        critical_failed = False

        for metric in ("latency_p95", "error_rate", "cpu_usage", "memory_usage"):
            ratio = exceed_ratios[metric]
            tolerance = TOLERANCES[metric]
            if ratio > tolerance:
                failed_metrics.add(metric)

        if pre_rps > 0:
            ratio = exceed_ratios["requests_per_sec"]
            if ratio > RPS_PERSISTENCE_TOLERANCE:
                failed_metrics.add("requests_per_sec")

        if failed_metrics & critical_metrics:
            critical_failed = True

        # Générer le verdict final (mapping ajusté)
        if not failed_metrics:
            verdict, confidence, summary = "ok", 0.9, "No significant regression detected"
        elif critical_failed:
            verdict, confidence, summary = "rollback_recommended", 0.85, "Critical regression detected"
        elif len(failed_metrics) == 1:
            verdict, confidence, summary = "warning", 0.7, "Potential performance degradation detected"
        else:
            verdict, confidence, summary = "rollback_recommended", 0.85, "Multiple critical regressions detected"

        created = _create_verdict(db, deployment_id, verdict, confidence, summary, flags)

        created_at = max((s.collected_at for s in post_samples), default=None)
        if not created_at:
            created_at = datetime.now(timezone.utc)
        if created:
            metrics_audit = {
                "latency_p95": {
                    "secured_threshold": secured_thresholds["latency_p95"],
                    "exceed_ratio": exceed_ratios["latency_p95"],
                    "tolerance": TOLERANCES["latency_p95"],
                },
                "error_rate": {
                    "secured_threshold": secured_thresholds["error_rate"],
                    "exceed_ratio": exceed_ratios["error_rate"],
                    "tolerance": TOLERANCES["error_rate"],
                },
                "cpu_usage": {
                    "secured_threshold": secured_thresholds["cpu_usage"],
                    "exceed_ratio": exceed_ratios["cpu_usage"],
                    "tolerance": TOLERANCES["cpu_usage"],
                },
                "memory_usage": {
                    "secured_threshold": secured_thresholds["memory_usage"],
                    "exceed_ratio": exceed_ratios["memory_usage"],
                    "tolerance": TOLERANCES["memory_usage"],
                },
                "requests_per_sec": {
                    "secured_threshold": (
                        pre_rps * (1 - RPS_DROP_THRESHOLD) if pre_rps > 0 else None
                    ),
                    "exceed_ratio": exceed_ratios["requests_per_sec"],
                    "tolerance": RPS_PERSISTENCE_TOLERANCE,
                },
            }
            generate_sdh_hints(
                db=db,
                deployment=deployment,
                pre_agg=pre_agg,
                post_agg=post_agg,
                created_at=created_at,
                metrics_audit=metrics_audit,
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

    project_plan = getattr(project, "plan", "free") if project else "free"
    if project and project_plan == "pro":
        if _is_first_project_verdict(db, deployment.project_id):
            try:
                schedule_slack(
                    db,
                    user_id=owner.id,
                    project_id=deployment.project_id,
                    notification_type=SLACK_TYPE_FIRST_VERDICT_AVAILABLE,
                    dedupe_key=f"slack:first_verdict_available:{deployment.project_id}",
                    message_text=(
                        f"SeqPulse • First verdict available for *{context['project_name']}* "
                        f"(env: `{context['env']}`) — verdict: *{context['verdict']}*."
                    ),
                    deployment_id=deployment.id,
                )
            except Exception as exc:
                logger.warning(
                    "first_verdict_slack_schedule_failed",
                    deployment_id=str(deployment.id),
                    project_id=str(deployment.project_id),
                    user_id=str(owner.id),
                    error=str(exc),
                )

        if verdict in {"warning", "rollback_recommended"}:
            try:
                schedule_slack(
                    db,
                    user_id=owner.id,
                    project_id=deployment.project_id,
                    notification_type=SLACK_TYPE_CRITICAL_VERDICT_ALERT,
                    dedupe_key=f"slack:critical_verdict_alert:{deployment.id}",
                    message_text=(
                        f"SeqPulse • Critical verdict for *{context['project_name']}* "
                        f"(env: `{context['env']}`) — verdict: *{context['verdict']}*."
                    ),
                    deployment_id=deployment.id,
                )
            except Exception as exc:
                logger.warning(
                    "critical_verdict_slack_schedule_failed",
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
