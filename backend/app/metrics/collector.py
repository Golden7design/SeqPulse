# app/metrics/collector.py
import httpx
import math
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse
from app.db.models.metric_sample import MetricSample

logger = logging.getLogger(__name__)

def _require_float(data: dict, key: str) -> float:
    if key not in data:
        raise ValueError(f"Missing metric '{key}'")
    value = float(data[key])
    if not math.isfinite(value):
        raise ValueError(f"Metric '{key}' is not finite")
    return value

def _validate_range(name: str, value: float, min_value: float = None, max_value: float = None) -> None:
    if min_value is not None and value < min_value:
        raise ValueError(f"Metric '{name}' below minimum {min_value}: {value}")
    if max_value is not None and value > max_value:
        raise ValueError(f"Metric '{name}' above maximum {max_value}: {value}")

def collect_metrics(
    deployment_id,
    phase: str,
    metrics_endpoint: str,
    db,
    use_hmac: bool = False,
    secret: str = None,
    project_id: str = None,
):
    """
    Collecte les métriques depuis l'endpoint fourni.
    Si use_hmac=True et secret est fourni, signe la requête.
    """
    headers = {}
    
    if use_hmac and not secret:
        raise ValueError("HMAC enabled but secret is missing")

    if use_hmac and secret:

        # Canonicaliser le path : ignorer query params, fragments, etc.
        parsed = urlparse(metrics_endpoint)
        raw_path = parsed.path or "/"
        
        # Générer timestamp ISO 8601
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Construire la signature (v2) avec nonce + method + path normalisé
        from app.metrics.security import (
            build_signature,
            canonicalize_path,
            generate_nonce,
            SIGNATURE_VERSION,
            NONCE_TTL_SECONDS,
        )
        nonce = generate_nonce()
        path = canonicalize_path(raw_path)
        signature = build_signature(secret, timestamp, path, method="GET", nonce=nonce)
        
        # Ajouter les headers
        headers.update({
            "X-SeqPulse-Timestamp": timestamp,
            "X-SeqPulse-Signature": signature,
            "X-SeqPulse-Nonce": nonce,
            "X-SeqPulse-Signature-Version": SIGNATURE_VERSION,
            "X-SeqPulse-Canonical-Path": path,
            "X-SeqPulse-Method": "GET",
            "X-SeqPulse-Nonce-TTL": str(NONCE_TTL_SECONDS),
        })
        if project_id:
            headers["X-SeqPulse-Project-Id"] = str(project_id)

    try:
        resp = httpx.get(metrics_endpoint, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json().get("metrics", {})
    except httpx.RequestError as e:
        raise ValueError(f"Failed to fetch metrics from {metrics_endpoint}: {e}")
    except httpx.HTTPStatusError as e:
        if use_hmac and e.response.status_code in (401, 403):
            logger.warning(
                "HMAC validation failed for %s (status=%s)",
                metrics_endpoint,
                e.response.status_code,
            )
            raise ValueError(
                "HMAC validation failed: check secret, timestamp skew, path normalization, and nonce usage"
            )
        raise ValueError(f"HTTP error {e.response.status_code} from {metrics_endpoint}")

    try:
        if not isinstance(data, dict):
            raise ValueError("Metrics payload must be an object")

        requests_per_sec = _require_float(data, "requests_per_sec")
        latency_p95 = _require_float(data, "latency_p95")
        error_rate = _require_float(data, "error_rate")
        cpu_usage = _require_float(data, "cpu_usage")
        memory_usage = _require_float(data, "memory_usage")

        _validate_range("requests_per_sec", requests_per_sec, min_value=0.0)
        _validate_range("latency_p95", latency_p95, min_value=0.0)
        _validate_range("error_rate", error_rate, min_value=0.0, max_value=1.0)
        _validate_range("cpu_usage", cpu_usage, min_value=0.0, max_value=1.0)
        _validate_range("memory_usage", memory_usage, min_value=0.0, max_value=1.0)

        sample = MetricSample(
            deployment_id=deployment_id,
            phase=phase,
            requests_per_sec=requests_per_sec,
            latency_p95=latency_p95,
            error_rate=error_rate,
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            collected_at=datetime.now(timezone.utc),
        )
        db.add(sample)
        db.commit()
    except (TypeError, ValueError) as e:
        db.rollback()
        raise ValueError(f"Invalid metric value in {data}: {e}")
