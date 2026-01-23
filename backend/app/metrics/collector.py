# app/metrics/collector.py
import httpx
from datetime import datetime, timezone
from urllib.parse import urlparse
from app.db.models.metric_sample import MetricSample

def collect_metrics(
    deployment_id,
    phase: str,
    metrics_endpoint: str,
    db,
    use_hmac: bool = False,
    secret: str = None,
):
    """
    Collecte les métriques depuis l'endpoint fourni.
    Si use_hmac=True et secret est fourni, signe la requête.
    """
    headers = {}
    
    if use_hmac and secret:
        # Canonicaliser le path : ignorer query params, fragments, etc.
        parsed = urlparse(metrics_endpoint)
        path = parsed.path or "/"
        
        # Générer timestamp ISO 8601
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Construire la signature
        from app.metrics.security import build_signature
        signature = build_signature(secret, timestamp, path)
        
        # Ajouter les headers
        headers.update({
            "X-SeqPulse-Timestamp": timestamp,
            "X-SeqPulse-Signature": signature,
        })

    try:
        resp = httpx.get(metrics_endpoint, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json().get("metrics", {})
    except httpx.RequestError as e:
        raise ValueError(f"Failed to fetch metrics from {metrics_endpoint}: {e}")
    except httpx.HTTPStatusError as e:
        raise ValueError(f"HTTP error {e.response.status_code} from {metrics_endpoint}")

    try:
        sample = MetricSample(
            deployment_id=deployment_id,
            phase=phase,
            requests_per_sec=float(data.get("requests_per_sec", 0.0)),
            latency_p95=float(data.get("latency_p95", 0.0)),
            error_rate=float(data.get("error_rate", 0.0)),
            cpu_usage=float(data.get("cpu_usage", 0.0)),
            memory_usage=float(data.get("memory_usage", 0.0)),
            collected_at=datetime.now(timezone.utc),
        )
        db.add(sample)
        db.commit()
    except (TypeError, ValueError) as e:
        db.rollback()
        raise ValueError(f"Invalid metric value in {data}: {e}")