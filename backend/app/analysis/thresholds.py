# app/analysis/thresholds.py
def evaluate_metrics(samples):
    # MVP simple
    if not samples:
        return "ok", 0.3, "No metrics collected"

    # Exemple
    for s in samples:
        if s.error_rate > 0.05:
            return "rollback_recommended", 0.9, "High error rate detected"

    return "ok", 0.8, "No significant regression detected"
