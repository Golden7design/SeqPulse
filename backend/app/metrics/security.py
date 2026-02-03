# app/metrics/security.py
import hmac
import hashlib
import os
import secrets
from datetime import datetime, timezone

SIGNATURE_VERSION = "v2"

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default

MAX_SKEW_PAST = _env_int("SEQPULSE_HMAC_MAX_SKEW_PAST", 300)    # 5 minutes dans le passé
MAX_SKEW_FUTURE = _env_int("SEQPULSE_HMAC_MAX_SKEW_FUTURE", 30)  # 30 secondes dans le futur
NONCE_TTL_SECONDS = MAX_SKEW_PAST + MAX_SKEW_FUTURE

def canonicalize_path(path: str) -> str:
    """
    Normalise le path pour la signature:
    - Force un prefix "/"
    - Supprime le trailing slash (sauf si "/" uniquement)
    """
    if not path:
        return "/"
    if not path.startswith("/"):
        path = f"/{path}"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return path

def build_payload(timestamp: str, method: str, path: str, nonce: str) -> str:
    """
    Construit le payload HMAC v2: timestamp|METHOD|path|nonce
    """
    normalized_path = canonicalize_path(path)
    method = (method or "GET").upper()
    return f"{timestamp}|{method}|{normalized_path}|{nonce}"

def build_signature(secret: str, timestamp: str, path: str, method: str = "GET", nonce: str = "") -> str:
    """
    Construit une signature HMAC-SHA256 à partir du secret, timestamp, method, path et nonce.
    Format: sha256=<hex>
    """
    payload = build_payload(timestamp, method, path, nonce)
    digest = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={digest}"

def generate_nonce() -> str:
    return secrets.token_urlsafe(16)

def validate_timestamp(ts: str):
    """
    Valide que le timestamp est dans la fenêtre autorisée :
    - Pas plus de 5 min dans le passé
    - Pas plus de 30s dans le futur
    """
    now = datetime.now(timezone.utc)
    sent = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    delta = (now - sent).total_seconds()  # positif = dans le passé

    if delta > MAX_SKEW_PAST:
        raise ValueError("Timestamp too old")
    if delta < -MAX_SKEW_FUTURE:
        raise ValueError("Timestamp too far in the future")
