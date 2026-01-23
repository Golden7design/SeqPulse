# app/metrics/security.py
import hmac
import hashlib
from datetime import datetime, timezone

MAX_SKEW_PAST = 300    # 5 minutes dans le passé
MAX_SKEW_FUTURE = 30   # 30 secondes dans le futur

def build_signature(secret: str, timestamp: str, path: str) -> str:
    """
    Construit une signature HMAC-SHA256 à partir du secret, timestamp et path.
    Format: sha256=<hex>
    """
    payload = f"{timestamp}|{path}"
    digest = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={digest}"

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