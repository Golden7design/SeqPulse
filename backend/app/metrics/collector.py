# app/metrics/collector.py
import httpx
import math
from datetime import datetime, timezone
from urllib.parse import urlparse
import time
import structlog
from app.db.models.metric_sample import MetricSample
from app.observability.metrics import inc_metrics_collected
from sqlalchemy.exc import IntegrityError

logger = structlog.get_logger(__name__)


class MetricsHMACValidationError(ValueError):
    """Raised when endpoint-side HMAC validation rejects the request."""


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


def _build_hmac_headers(metrics_endpoint: str, secret: str, project_id: str | None = None) -> dict[str, str]:
    if not secret:
        raise MetricsHMACValidationError("HMAC enabled but secret is missing")

    parsed = urlparse(metrics_endpoint)
    raw_path = parsed.path or "/"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

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

    headers = {
        "X-SeqPulse-Timestamp": timestamp,
        "X-SeqPulse-Signature": signature,
        "X-SeqPulse-Nonce": nonce,
        "X-SeqPulse-Signature-Version": SIGNATURE_VERSION,
        "X-SeqPulse-Canonical-Path": path,
        "X-SeqPulse-Method": "GET",
        "X-SeqPulse-Nonce-TTL": str(NONCE_TTL_SECONDS),
    }
    if project_id:
        headers["X-SeqPulse-Project-Id"] = str(project_id)
    return headers


def _fetch_metrics_payload(
    *,
    deployment_id,
    phase: str,
    metrics_endpoint: str,
    use_hmac: bool = False,
    secret: str = None,
    project_id: str = None,
    timeout_seconds: float = 5.0,
) -> tuple[dict, int]:
    started_at = time.perf_counter()
    headers: dict[str, str] = {}

    if use_hmac:
        headers = _build_hmac_headers(metrics_endpoint=metrics_endpoint, secret=secret, project_id=project_id)

    try:
        resp = httpx.get(metrics_endpoint, headers=headers, timeout=timeout_seconds)
        resp.raise_for_status()
        data = resp.json().get("metrics", {})
        return data, int((time.perf_counter() - started_at) * 1000)
    except httpx.RequestError as e:
        logger.warning(
            "metrics_fetch_failed",
            deployment_id=str(deployment_id),
            phase=phase,
            metrics_endpoint=metrics_endpoint,
            error=str(e),
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        raise ValueError(f"Failed to fetch metrics from {metrics_endpoint}: {e}")
    except httpx.HTTPStatusError as e:
        if use_hmac and e.response.status_code in (401, 403):
            logger.warning(
                "metrics_hmac_validation_failed",
                deployment_id=str(deployment_id),
                phase=phase,
                metrics_endpoint=metrics_endpoint,
                status_code=e.response.status_code,
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            raise MetricsHMACValidationError(
                "HMAC validation failed: check secret, timestamp skew, path normalization, and nonce usage"
            )
        logger.warning(
            "metrics_http_status_error",
            deployment_id=str(deployment_id),
            phase=phase,
            metrics_endpoint=metrics_endpoint,
            status_code=e.response.status_code,
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        raise ValueError(f"HTTP error {e.response.status_code} from {metrics_endpoint}")


def probe_metrics_endpoint_hmac(
    *,
    metrics_endpoint: str,
    use_hmac: bool,
    secret: str | None,
    project_id: str | None,
    phase: str,
    timeout_seconds: float = 2.5,
) -> None:
    # Probe d'accessibilité/sécurité uniquement, sans persistance.
    _fetch_metrics_payload(
        deployment_id="preflight",
        phase=phase,
        metrics_endpoint=metrics_endpoint,
        use_hmac=use_hmac,
        secret=secret,
        project_id=project_id,
        timeout_seconds=timeout_seconds,
    )


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
    data, fetch_duration_ms = _fetch_metrics_payload(
        deployment_id=deployment_id,
        phase=phase,
        metrics_endpoint=metrics_endpoint,
        use_hmac=use_hmac,
        secret=secret,
        project_id=project_id,
    )

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
        try:
            db.commit()
        except IntegrityError:
            # Doublon de métriques -> ignore (idempotent)
            db.rollback()
            logger.info(
                "metric_sample_duplicate",
                deployment_id=str(deployment_id),
                phase=phase,
                collected_at=sample.collected_at.isoformat(),
                duration_ms=fetch_duration_ms,
            )
            return
        logger.info(
            "metrics_collected",
            deployment_id=str(deployment_id),
            phase=phase,
            metrics_endpoint=metrics_endpoint,
            requests_per_sec=requests_per_sec,
            latency_p95=latency_p95,
            error_rate=error_rate,
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            duration_ms=fetch_duration_ms,
        )
        inc_metrics_collected(phase=phase)
    except (TypeError, ValueError) as e:
        db.rollback()
        logger.warning(
            "metrics_payload_invalid",
            deployment_id=str(deployment_id),
            phase=phase,
            metrics_endpoint=metrics_endpoint,
            error=str(e),
            duration_ms=fetch_duration_ms,
        )
        raise ValueError(f"Invalid metric value in {data}: {e}")
