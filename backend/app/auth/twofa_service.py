import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Iterable
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet, InvalidToken

from app.core.security import get_password_hash, verify_password
from app.core.settings import settings
from app.db.models.user import User

RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _totp_digits() -> int:
    digits = int(getattr(settings, "TWOFA_CODE_DIGITS", 6) or 6)
    return max(6, min(8, digits))


def _totp_period_seconds() -> int:
    period = int(getattr(settings, "TWOFA_PERIOD_SECONDS", 30) or 30)
    return max(15, min(120, period))


def _totp_valid_window() -> int:
    window = int(getattr(settings, "TWOFA_VALID_WINDOW", 1) or 1)
    return max(0, min(3, window))


def _recovery_codes_count() -> int:
    count = int(getattr(settings, "TWOFA_RECOVERY_CODES_COUNT", 10) or 10)
    return max(5, min(20, count))


def _twofa_issuer() -> str:
    issuer = (getattr(settings, "TWOFA_ISSUER", "SEQPULSE") or "SEQPULSE").strip()
    return issuer or "SEQPULSE"


def _derive_fernet_key(raw: bytes) -> bytes:
    digest = hashlib.sha256(raw).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet_key() -> bytes:
    configured = (getattr(settings, "TWOFA_ENCRYPTION_KEY", "") or "").strip()
    if configured:
        key_bytes = configured.encode("utf-8")
        try:
            Fernet(key_bytes)
            return key_bytes
        except Exception:
            return _derive_fernet_key(key_bytes)
    return _derive_fernet_key(settings.SECRET_KEY.encode("utf-8"))


def _fernet() -> Fernet:
    return Fernet(_fernet_key())


def generate_totp_secret() -> str:
    # 20 random bytes is the common default for SHA1 TOTP secrets.
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def encrypt_totp_secret(secret: str) -> str:
    normalized = normalize_totp_secret(secret)
    encrypted = _fernet().encrypt(normalized.encode("utf-8"))
    return encrypted.decode("utf-8")


def decrypt_totp_secret(encrypted_secret: str) -> str:
    try:
        decrypted = _fernet().decrypt(encrypted_secret.encode("utf-8"))
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted 2FA secret.") from exc
    return decrypted.decode("utf-8")


def normalize_totp_secret(secret: str) -> str:
    cleaned = secret.strip().replace(" ", "").upper()
    if not cleaned:
        raise ValueError("2FA secret cannot be empty.")
    _decode_base32_secret(cleaned)
    return cleaned


def _decode_base32_secret(secret: str) -> bytes:
    normalized = secret.strip().replace(" ", "").upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    try:
        return base64.b32decode(normalized + padding, casefold=True)
    except Exception as exc:
        raise ValueError("Invalid 2FA secret format.") from exc


def build_totp_uri(secret: str, account_name: str, issuer: str | None = None) -> str:
    normalized_secret = normalize_totp_secret(secret)
    issuer_value = (issuer or _twofa_issuer()).strip() or _twofa_issuer()
    label = quote(f"{issuer_value}:{account_name}", safe="")
    params = urlencode(
        {
            "secret": normalized_secret,
            "issuer": issuer_value,
            "algorithm": "SHA1",
            "digits": _totp_digits(),
            "period": _totp_period_seconds(),
        }
    )
    return f"otpauth://totp/{label}?{params}"


def _totp_step(for_time: datetime) -> int:
    return int(for_time.timestamp()) // _totp_period_seconds()


def _hotp(secret_bytes: bytes, counter: int, digits: int) -> str:
    digest = hmac.new(secret_bytes, counter.to_bytes(8, "big"), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = (
        ((digest[offset] & 0x7F) << 24)
        | (digest[offset + 1] << 16)
        | (digest[offset + 2] << 8)
        | digest[offset + 3]
    )
    code = binary % (10 ** digits)
    return str(code).zfill(digits)


def get_totp_code(secret: str, for_time: datetime | None = None) -> str:
    instant = for_time or datetime.now(timezone.utc)
    secret_bytes = _decode_base32_secret(secret)
    return _hotp(secret_bytes, _totp_step(instant), _totp_digits())


def _normalize_totp_code(code: str) -> str:
    digits_only = "".join(ch for ch in (code or "").strip() if ch.isdigit())
    return digits_only


def find_matching_totp_step(
    secret: str,
    code: str,
    for_time: datetime | None = None,
    valid_window: int | None = None,
) -> int | None:
    normalized_code = _normalize_totp_code(code)
    digits = _totp_digits()
    if len(normalized_code) != digits:
        return None

    instant = for_time or datetime.now(timezone.utc)
    current_step = _totp_step(instant)
    window = _totp_valid_window() if valid_window is None else max(0, valid_window)

    secret_bytes = _decode_base32_secret(secret)
    for offset in range(-window, window + 1):
        candidate_step = current_step + offset
        if candidate_step < 0:
            continue
        expected = _hotp(secret_bytes, candidate_step, digits)
        if secrets.compare_digest(expected, normalized_code):
            return candidate_step
    return None


def verify_totp_code(
    user: User,
    code: str,
    for_time: datetime | None = None,
    valid_window: int | None = None,
) -> bool:
    if not user.twofa_secret_encrypted:
        return False

    secret = decrypt_totp_secret(user.twofa_secret_encrypted)
    matched_step = find_matching_totp_step(
        secret=secret,
        code=code,
        for_time=for_time,
        valid_window=valid_window,
    )
    if matched_step is None:
        return False

    last_step = user.twofa_last_totp_step
    if last_step is not None and matched_step <= int(last_step):
        return False

    verified_at = for_time or datetime.now(timezone.utc)
    user.twofa_last_totp_step = matched_step
    user.twofa_last_verified_at = verified_at
    return True


def _raw_recovery_code(length: int = 8) -> str:
    return "".join(secrets.choice(RECOVERY_CODE_ALPHABET) for _ in range(length))


def format_recovery_code(raw_code: str) -> str:
    cleaned = "".join(ch for ch in raw_code.upper() if ch.isalnum())
    if len(cleaned) <= 4:
        return cleaned
    return f"{cleaned[:4]}-{cleaned[4:]}"


def normalize_recovery_code(code: str) -> str:
    return "".join(ch for ch in (code or "").upper() if ch.isalnum())


def generate_recovery_codes(count: int | None = None) -> tuple[list[str], list[str]]:
    target_count = _recovery_codes_count() if count is None else max(1, count)
    plain_codes: list[str] = []
    hashed_codes: list[str] = []

    for _ in range(target_count):
        raw = _raw_recovery_code(length=8)
        normalized = normalize_recovery_code(raw)
        plain_codes.append(format_recovery_code(normalized))
        hashed_codes.append(get_password_hash(normalized))

    return plain_codes, hashed_codes


def _iter_hashed_codes(value: object) -> Iterable[str]:
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item.strip():
                yield item


def count_recovery_codes_remaining(user: User) -> int:
    return sum(1 for _ in _iter_hashed_codes(user.twofa_recovery_codes_hash))


def verify_and_consume_recovery_code(user: User, code: str, for_time: datetime | None = None) -> bool:
    normalized = normalize_recovery_code(code)
    if not normalized:
        return False

    hashed_codes = list(_iter_hashed_codes(user.twofa_recovery_codes_hash))
    for idx, hashed in enumerate(hashed_codes):
        if verify_password(normalized, hashed):
            remaining = hashed_codes[:idx] + hashed_codes[idx + 1 :]
            user.twofa_recovery_codes_hash = remaining
            user.twofa_last_verified_at = for_time or datetime.now(timezone.utc)
            return True

    return False
