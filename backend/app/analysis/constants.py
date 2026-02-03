# app/analysis/constants.py

# Seuils absolus basés sur les bonnes pratiques SRE (Google, AWS, Azure)
ABSOLUTE_THRESHOLDS = {
    "latency_p95": 300.0,   # ms
    "error_rate": 0.01,     # 1%
    "cpu_usage": 0.80,      # 80%
    "memory_usage": 0.85,   # 85%
}

# Trafic minimal pour considérer une baseline significative
MIN_TRAFFIC_THRESHOLD = 0.1  # requêtes par seconde
