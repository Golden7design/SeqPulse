from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, List
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment_verdict import DeploymentVerdict

# Métriques connues pour l'analyse (MVP)
KNOWN_METRICS = {"error_rate", "latency_p95", "cpu_usage", "memory", "requests"}

# Seuils par métrique (MVP)
THRESHOLDS = {
    "error_rate": 0.5,   # +50%
    "latency_p95": 0.3,  # +30%
    "cpu_usage": 0.5,
    "memory": 0.7,
    "requests": -0.4     # -40% = perte de trafic
}

def analyze_deployment(deployment_id: UUID, db: Session) -> bool:
    """
    Analyse un déploiement terminé et génère un verdict.
    - Stocke TOUTES les métriques reçues (auditabilité)
    - N'analyse que les métriques connues (robustesse)
    - Retourne True si l'analyse a été effectuée.
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

    # 3. Cas : pas de données → verdict "ok"
    if not pre_samples or not post_samples:
        _create_verdict(db, deployment_id, "ok", 1.0, "No metrics to compare", [])
        return True

    # 4. Agréger par métrique (moyenne)
    def _aggregate(samples: List[MetricSample]) -> Dict[str, float]:
        agg = {}
        count = {}
        for s in samples:
            # Ignorer les noms vides ou non-string (théoriquement impossible grâce à Pydantic)
            if not s.name or not isinstance(s.name, str):
                continue
            agg[s.name] = agg.get(s.name, 0.0) + s.value
            count[s.name] = count.get(s.name, 0) + 1
        return {k: v / count[k] for k, v in agg.items()}

    pre_agg = _aggregate(pre_samples)
    post_agg = _aggregate(post_samples)

    # 5. Filtrer les métriques connues
    analyzed_metrics = KNOWN_METRICS & (set(pre_agg.keys()) | set(post_agg.keys()))

    # 6. Détecter les anomalies
    flags = []
    for metric in analyzed_metrics:
        baseline = pre_agg.get(metric, 0.0)
        current = post_agg.get(metric, 0.0)
        
        # Éviter la division par zéro
        if baseline == 0:
            if current == 0:
                delta_pct = 0.0
            else:
                # Croissance infinie → considérer comme critique
                delta_pct = float('inf')
        else:
            delta_pct = (current - baseline) / baseline

        threshold = THRESHOLDS.get(metric, 0.5)
        
        # Gérer le cas "infini" (baseline=0, current>0)
        if delta_pct == float('inf'):
            change = "+∞%"
            flags.append(f"{metric} changed by {change}")
        elif delta_pct > threshold:
            change = f"+{delta_pct:.0%}" if delta_pct >= 0 else f"{delta_pct:.0%}"
            flags.append(f"{metric} changed by {change}")

    # 7. Générer le verdict
    if not flags:
        verdict, confidence, summary = "ok", 1.0, "No significant changes detected"
    elif len(flags) == 1:
        verdict, confidence, summary = "attention", 0.8, "Minor degradation detected"
    else:
        verdict, confidence, summary = "rollback_recommended", 0.6, "Multiple issues detected"

    # 8. Sauvegarder le verdict
    _create_verdict(db, deployment_id, verdict, confidence, summary, flags)
    
    # 9. Mettre à jour le statut du déploiement
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
    """Crée une entrée de verdict (idempotent)."""
    existing = db.query(DeploymentVerdict).filter(
        DeploymentVerdict.deployment_id == deployment_id
    ).first()
    
    if existing:
        return  # Ne pas écraser un verdict existant
    
    verdict_obj = DeploymentVerdict(
        deployment_id=deployment_id,
        verdict=verdict,
        confidence=confidence,
        summary=summary,
        details=details
    )
    db.add(verdict_obj)
    db.commit()