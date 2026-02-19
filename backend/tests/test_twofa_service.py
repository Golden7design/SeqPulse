from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.auth import twofa_service


def _fake_user(encrypted_secret: str, *, last_step: int | None = None, recovery_hashes=None):
    return SimpleNamespace(
        twofa_secret_encrypted=encrypted_secret,
        twofa_last_totp_step=last_step,
        twofa_last_verified_at=None,
        twofa_recovery_codes_hash=recovery_hashes,
    )


def test_totp_secret_encryption_roundtrip():
    secret = twofa_service.generate_totp_secret()
    encrypted = twofa_service.encrypt_totp_secret(secret)
    decrypted = twofa_service.decrypt_totp_secret(encrypted)

    assert decrypted == twofa_service.normalize_totp_secret(secret)


def test_build_totp_uri_contains_standard_parameters():
    secret = twofa_service.generate_totp_secret()
    uri = twofa_service.build_totp_uri(secret=secret, account_name="user@example.com", issuer="SEQPULSE")

    assert uri.startswith("otpauth://totp/")
    assert "secret=" in uri
    assert "issuer=SEQPULSE" in uri
    assert "digits=6" in uri
    assert "period=30" in uri


def test_verify_totp_code_accepts_valid_code_and_prevents_replay():
    secret = twofa_service.generate_totp_secret()
    encrypted = twofa_service.encrypt_totp_secret(secret)
    now = datetime.now(timezone.utc)

    code = twofa_service.get_totp_code(secret, for_time=now)
    user = _fake_user(encrypted_secret=encrypted, last_step=None)

    assert twofa_service.verify_totp_code(user=user, code=code, for_time=now) is True
    first_step = user.twofa_last_totp_step
    assert isinstance(first_step, int)

    assert twofa_service.verify_totp_code(user=user, code=code, for_time=now) is False


def test_verify_totp_code_respects_valid_window():
    secret = twofa_service.generate_totp_secret()
    encrypted = twofa_service.encrypt_totp_secret(secret)
    period = 30
    now = datetime.now(timezone.utc).replace(microsecond=0)
    previous_slot_time = now - timedelta(seconds=period)
    code_from_previous_slot = twofa_service.get_totp_code(secret, for_time=previous_slot_time)

    user = _fake_user(encrypted_secret=encrypted, last_step=None)
    assert (
        twofa_service.verify_totp_code(
            user=user,
            code=code_from_previous_slot,
            for_time=now,
            valid_window=1,
        )
        is True
    )


def test_recovery_codes_are_hashed_and_single_use():
    plain_codes, hashed_codes = twofa_service.generate_recovery_codes(count=2)
    user = _fake_user(encrypted_secret="", recovery_hashes=hashed_codes)
    first_code = plain_codes[0]

    assert twofa_service.count_recovery_codes_remaining(user) == 2
    assert twofa_service.verify_and_consume_recovery_code(user, first_code) is True
    assert twofa_service.count_recovery_codes_remaining(user) == 1

    assert twofa_service.verify_and_consume_recovery_code(user, first_code) is False
    assert twofa_service.count_recovery_codes_remaining(user) == 1
