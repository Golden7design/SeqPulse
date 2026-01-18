from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, List
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment_verdict import DeploymentVerdict

def analyze_deployment(deployment_id: UUID, db: Session) -> bool:
    """
    Analyse un déploiement terminé et génère un verdict.
    Retourne True si l'analyse a été effectuée.
    """
    # 1. Vérifier que le déploiement est prêt à être analysé
    deployment = db.query(Deployment).filter(
        Deployment.id == deployment_id,
        Deployment.status.in_(["success", "failed"]),
        Deployment.finished_at.isnot(None)
    ).first()
    
    if not deployment:
        return False

    # 2. Récupérer toutes les métriques PRE et POST
    pre_samples = db.query(MetricSample).filter(
        MetricSample.deployment_id == deployment_id,
        MetricSample.window == "pre"
    ).all()
    
    post_samples = db.query(MetricSample).filter(
        MetricSample.deployment_id == deployment_id,
        MetricSample.window == "post"
    ).all()

    if not pre_samples or not post_samples:
        # Pas assez de données → verdict "ok" par défaut
        _create_verdict(db, deployment_id, "ok", 1.0, "No metrics to compare", [])
        return True

    # 3. Agréger par métrique (moyenne)
    def _aggregate(samples: List[MetricSample]) -> Dict[str, float]:
        agg = {}
        count = {}
        for s in samples:
            agg[s.name] = agg.get(s.name, 0) + s.value
            count[s.name] = count.get(s.name, 0) + 1
        return {k: v / count[k] for k, v in agg.items()}

    pre_agg = _aggregate(pre_samples)
    post_agg = _aggregate(post_samples)

    # 4. Définir les seuils (MVP)
    thresholds = {
        "error_rate": 0.5,   # +50%
        "latency_p95": 0.3,  # +30%
        "cpu_usage": 0.5,
        "memory": 0.7,
        "requests": -0.4     # -40% = perte de trafic
    }

    # 5. Détecter les anomalies
    flags = []
    for metric, baseline in pre_agg.items():
        current = post_agg.get(metric, 0.0)
        
        if baseline == 0:
            delta_pct = float('inf') if current > 0 else 0.0
        else:
            delta_pct = (current - baseline) / baseline

        threshold = thresholds.get(metric, 0.5)
        if delta_pct > threshold:
            change = f"+{delta_pct:.0%}" if delta_pct >= 0 else f"{delta_pct:.0%}"
            flags.append(f"{metric} changed by {change}")

    # 6. Générer le verdict
    if not flags:
        verdict, confidence, summary = "ok", 1.0, "No significant changes detected"
    elif len(flags) == 1:
        verdict, confidence, summary = "attention", 0.8, "Minor degradation detected"
    else:
        verdict, confidence, summary = "rollback_recommended", 0.6, "Multiple issues detected"

    # 7. Sauvegarder le verdict
    _create_verdict(db, deployment_id, verdict, confidence, summary, flags)
    
    # 8. Mettre à jour le statut du déploiement
    deployment.status = "analyzed"
    db.commit()
    
    return True


def _create_verdict(
    db: Session,
    deployment_id: UUID,
    verdict: str,
    confidence: float,
    summary: str,
    details: List[str]
):
    """Crée une entrée de verdict."""
    existing = db.query(DeploymentVerdict).filter(
        DeploymentVerdict.deployment_id == deployment_id
    ).first()
    
    if existing:
        return  # Ne pas écraser
    
    verdict_obj = DeploymentVerdict(
        deployment_id=deployment_id,
        verdict=verdict,
        confidence=confidence,
        summary=summary,
        details=details
    )
    db.add(verdict_obj)
    db.commit()