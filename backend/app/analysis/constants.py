# app/analysis/constants.py

# Seuils industriels (référence).
INDUSTRIAL_THRESHOLDS = {
    "latency_p95": 300.0,   # ms
    "error_rate": 0.01,     # 1%
    "cpu_usage": 0.80,      # 80%
    "memory_usage": 0.80,   # 80%
}

# Seuil sécurisé = seuil industriel * facteur de sécurité.
SECURED_THRESHOLD_FACTOR = 0.9

# Tolérances (ratio max de séquences en dépassement).
TOLERANCES = {
    "latency_p95": 0.20,
    "error_rate": 0.05,
    "cpu_usage": 0.20,
    "memory_usage": 0.10,
    "requests_per_sec": 0.20,
}

# Requests per sec: seuil de baisse et tolérance de persistance.
RPS_DROP_THRESHOLD = 0.20
RPS_PERSISTENCE_TOLERANCE = 0.20

# Trafic minimal pour considérer une baseline significative (SDH / hints).
MIN_TRAFFIC_THRESHOLD = 0.1  # requêtes par seconde

# Compat: exposer le nom historique si nécessaire.
ABSOLUTE_THRESHOLDS = INDUSTRIAL_THRESHOLDS
