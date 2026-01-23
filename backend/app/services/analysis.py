"""
SeqPulse Analysis Engine

Architecture Decision Records (ADR):

1. THRESHOLDS:
   -MVP: Fixed thresholds per metric
   -v2: Configurable per project (project_settings table)
   -v3: Adaptive baselines (statistical models, percentiles)

2. METRICS HANDLING:
   -ALL metrics are stored (auditability, compliance)
   -ONLY known metrics are analyzed (robustness)
   -Unknown metrics are logged for future learning

3. DECISION LOGIC:
   -0 flags → "ok" (high confidence)
-1 flag → "attention" (medium confidence)
   -2+ flags → "rollback_recommended" (low confidence)
   
4. FUTURE ENHANCEMENTS:
   -Environment-aware thresholds (prod vs staging)
   -Historical percentiles (p50, p75, p95, p99)
   -Anomaly detection (statistical outliers)
   -Multi-window comparison (last 3 deploys)
"""

from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, List, Tuple
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.deployment_verdict import DeploymentVerdict
from app.db.models.project import Project


# CONFIGURATION

# Métriques connues et analysées (MVP)
# TODO v2: Charger depuis project_settings
KNOWN_METRICS = {
    "error_rate",
    "latency_p95",
    "latency_p99",
    "cpu_usage",
    "memory_usage",
    "requests_per_sec",
    "db_connections",
}

# Seuils de variation acceptable (MVP)
# Format: {metric: threshold}
# - Valeurs positives: détecte les augmentations > threshold
# - Valeurs négatives: détecte les diminutions < |threshold|
# TODO v2: Configurable par projet
# TODO v3: Baselines adaptatives (percentiles historiques)
DEFAULT_THRESHOLDS = {
    "error_rate": 0.5,          # +50% = critique
    "latency_p95": 0.3,         # +30% = attention
    "latency_p99": 0.4,         # +40% = attention
    "cpu_usage": 0.5,           # +50% = attention
    "memory_usage": 0.7,        # +70% = critique
    "requests_per_sec": -0.4,   # -40% = perte de trafic
    "db_connections": 0.6,      # +60% = attention
}


# ════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ════════════════════════════════════════════════════════════════

def _aggregate_metrics(samples: List[MetricSample]) -> Dict[str, float]:
    """
    Agrège les métriques par nom (moyenne).
    
    Rationale: Utiliser la moyenne plutôt que le dernier point permet
    de lisser les pics temporaires et d'obtenir une vue plus stable.
    
    KNOWN LIMITATION (MVP):
    For latency percentiles (p95, p99), averaging pre-computed percentiles
    is mathematically imprecise. Future versions will:
    - Store raw histograms (HdrHistogram, t-digest)
    - Calculate percentiles from raw data
    - Use weighted percentiles for aggregation
    
    This is acceptable for MVP because:
    - We're comparing relative changes (PRE vs POST)
    - The error is consistent across both windows
    - Still detects significant regressions (>30%)
    """
    agg = {}
    count = {}
    
    for sample in samples:
        # Ignorer les métriques invalides
        if not sample.name or not isinstance(sample.name, str):
            continue
        
        name = sample.name
        agg[name] = agg.get(name, 0.0) + sample.value
        count[name] = count.get(name, 0) + 1
    
    # Calculer la moyenne
    return {name: total / count[name] for name, total in agg.items()}


def _calculate_delta(baseline: float, current: float) -> float:
    """
    Calcule la variation relative entre baseline et current.
    
    Returns:
        float: Variation en pourcentage (ex: 0.3 = +30%)
        
    Special cases:
        - baseline = 0, current = 0 → 0.0 (pas de changement)
        - baseline = 0, current > 0 → +inf (apparition)
        - baseline > 0, current = 0 → -1.0 (disparition)
    """
    if baseline == 0:
        if current == 0:
            return 0.0
        else:
            return float('inf')  # Apparition de la métrique
    
    return (current - baseline) / baseline


def _is_anomaly(delta_pct: float, threshold: float) -> bool:
    """
    Détermine si une variation est anormale.
    
    Logic:
        - threshold > 0: détecte les augmentations (delta > threshold)
        - threshold < 0: détecte les diminutions (delta < threshold)
        - delta = +inf: toujours anormal (sauf si baseline=0 attendu)
    """
    # Cas spécial: apparition de métrique
    if delta_pct == float('inf'):
        return True
    
    # Cas normal: comparaison au seuil
    if threshold >= 0:
        return delta_pct > threshold
    else:
        return delta_pct < threshold


def _format_flag(
    metric: str,
    delta_pct: float,
    baseline: float,
    current: float
) -> str:
    """
    Formate un message d'anomalie pour le verdict.
    
    Format: "{metric} changed by {delta} (baseline: {baseline}, current: {current})"
    """
    if delta_pct == float('inf'):
        change = "+∞%"
    elif delta_pct == -1.0:
        change = "-100%"
    else:
        change = f"{delta_pct:+.0%}"
    
    return (
        f"{metric} changed by {change} "
        f"(baseline: {baseline:.2f}, current: {current:.2f})"
    )


def _compute_verdict(flags: List[str]) -> Tuple[str, float, str]:
    """
    Génère le verdict final basé sur le nombre d'anomalies.
    
    Decision logic (MVP):
        - 0 flags → ok (confidence: 1.0)
        - 1 flag → attention (confidence: 0.8)
        - 2+ flags → rollback_recommended (confidence: 0.6)
    
    Future enhancement:
        - Pondération par criticité de métrique
        - Corrélation entre métriques (ex: CPU + latency)
        - Score de confiance dynamique (basé sur historique)
    """
    if not flags:
        return "ok", 1.0, "No significant changes detected"
    
    elif len(flags) == 1:
        return "attention", 0.8, "Minor degradation detected"
    
    else:
        return "rollback_recommended", 0.6, "Multiple critical issues detected"


def _create_verdict(
    db: Session,
    deployment_id: UUID,
    verdict: str,
    confidence: float,
    summary: str,
    details: List[str]
):
    """
    Crée une entrée de verdict (idempotent).
    
    Si un verdict existe déjà, ne rien faire (évite les doublons).
    """
    existing = db.query(DeploymentVerdict).filter(
        DeploymentVerdict.deployment_id == deployment_id
    ).first()
    
    if existing:
        print(f"[Analysis] Verdict already exists for deployment {deployment_id}")
        return
    
    verdict_obj = DeploymentVerdict(
        deployment_id=deployment_id,
        verdict=verdict,
        confidence=confidence,
        summary=summary,
        details=details or []
    )
    db.add(verdict_obj)
    db.commit()
    
    print(f"[Analysis] Verdict created: {verdict} (confidence: {confidence:.2f})")


# FUTURE ENHANCEMENTS

def _load_project_thresholds(project_id: UUID, db: Session) -> Dict[str, float]:
    """
    [TODO v2] Charge les seuils configurés pour le projet.
    
    Schema:
        project_settings:
            - project_id: UUID
            - thresholds: JSONB
            
    Example:
        {
            "error_rate": 0.3,  # Plus strict que défaut (0.5)
            "latency_p95": 0.2,
            ...
        }
    """
    pass


def _calculate_adaptive_baseline(
    metric_name: str,
    project_id: UUID,
    env: str,
    db: Session
) -> Tuple[float, float]:
    """
    [TODO v3] Calcule une baseline adaptative basée sur l'historique.
    
    Returns:
        (p50, p95): Percentiles 50 et 95 des derniers N déploiements
        
    Logic:
        1. Récupérer les métriques PRE des 10 derniers déploiements
        2. Calculer p50, p95
        3. Détecter les outliers (> p95 + 2*IQR)
        
    Benefits:
        - Adaptée à chaque projet
        - Évite les faux positifs (baseline trop stricte)
        - Détecte les déviations par rapport à l'historique
    """
    pass