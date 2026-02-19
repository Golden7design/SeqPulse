from http.cookies import SimpleCookie
from typing import Any

import pytest
from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import routes as auth_routes
from app.auth.schemas import (
    TwoFAChallengeVerifyRequest,
    TwoFADisableRequest,
    TwoFARegenerateRecoveryCodesRequest,
    TwoFASetupVerifyRequest,
    UserLogin,
)
from app.auth.twofa_service import get_totp_code
from app.core.security import get_password_hash
from app.db.models.auth_challenge import AuthChallenge
from app.db.models.user import User


def _create_user(db: Session, *, email: str, password: str = "StrongP@ssw0rd") -> User:
    user = User(
        name="Test User",
        email=email,
        hashed_password=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_request(
    *,
    path: str,
    method: str = "POST",
    headers: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
) -> Request:
    normalized_headers: dict[str, str] = {k.lower(): v for k, v in (headers or {}).items()}
    if cookies:
        normalized_headers["cookie"] = "; ".join([f"{name}={value}" for name, value in cookies.items()])
    normalized_headers.setdefault("user-agent", "pytest-twofa")

    raw_headers = [(key.encode("latin-1"), value.encode("latin-1")) for key, value in normalized_headers.items()]

    scope: dict[str, Any] = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("latin-1"),
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


def _cookie_from_response(response: Response, cookie_name: str) -> str | None:
    cookie = SimpleCookie()
    for set_cookie_header in response.headers.getlist("set-cookie"):
        cookie.load(set_cookie_header)
    morsel = cookie.get(cookie_name)
    return morsel.value if morsel is not None else None


def _call_unwrapped(func, *args, **kwargs):
    target = getattr(func, "__wrapped__", func)
    return target(*args, **kwargs)


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    User.__table__.create(bind=engine)
    AuthChallenge.__table__.create(bind=engine)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_twofa_setup_regenerate_disable_flow(db_session: Session):
    _create_user(db_session, email="setup-flow@example.com")
    user = db_session.query(User).filter(User.email == "setup-flow@example.com").first()
    assert user is not None

    login_response = Response()
    login_payload = UserLogin(email="setup-flow@example.com", password="StrongP@ssw0rd")
    login_result = _call_unwrapped(
        auth_routes.login,
        _make_request(path="/auth/login"),
        login_response,
        login_payload,
        db_session,
    )
    assert login_result["requires_2fa"] is False

    setup_start_result = _call_unwrapped(
        auth_routes.twofa_setup_start,
        _make_request(path="/auth/2fa/setup/start"),
        Response(),
        user,
        db_session,
    )
    secret = setup_start_result["secret"]

    setup_verify_result = _call_unwrapped(
        auth_routes.twofa_setup_verify,
        _make_request(path="/auth/2fa/setup/verify"),
        Response(),
        TwoFASetupVerifyRequest(code=get_totp_code(secret)),
        user,
        db_session,
    )
    recovery_codes = setup_verify_result["recovery_codes"]
    assert len(recovery_codes) > 0

    status_after_enable = _call_unwrapped(
        auth_routes.twofa_status,
        _make_request(path="/auth/2fa/status", method="GET"),
        Response(),
        user,
    )
    assert status_after_enable["enabled"] is True

    regenerate_result = _call_unwrapped(
        auth_routes.twofa_regenerate_recovery_codes,
        _make_request(path="/auth/2fa/recovery-codes/regenerate"),
        Response(),
        TwoFARegenerateRecoveryCodesRequest(
            code=recovery_codes[0],
            use_recovery_code=True,
        ),
        user,
        db_session,
    )
    regenerated_codes = regenerate_result["recovery_codes"]
    assert len(regenerated_codes) > 0

    disable_result = _call_unwrapped(
        auth_routes.twofa_disable,
        _make_request(path="/auth/2fa/disable"),
        Response(),
        TwoFADisableRequest(
            code=regenerated_codes[0],
            use_recovery_code=True,
        ),
        user,
        db_session,
    )
    assert disable_result["message"] == "2FA disabled successfully."

    status_after_disable = _call_unwrapped(
        auth_routes.twofa_status,
        _make_request(path="/auth/2fa/status", method="GET"),
        Response(),
        user,
    )
    assert status_after_disable["enabled"] is False
    assert status_after_disable["recovery_codes_remaining"] == 0


def test_twofa_login_challenge_flow(db_session: Session):
    _create_user(db_session, email="challenge-flow@example.com")
    user = db_session.query(User).filter(User.email == "challenge-flow@example.com").first()
    assert user is not None

    _call_unwrapped(
        auth_routes.login,
        _make_request(path="/auth/login"),
        Response(),
        UserLogin(email="challenge-flow@example.com", password="StrongP@ssw0rd"),
        db_session,
    )

    setup_start_result = _call_unwrapped(
        auth_routes.twofa_setup_start,
        _make_request(path="/auth/2fa/setup/start"),
        Response(),
        user,
        db_session,
    )
    setup_verify_result = _call_unwrapped(
        auth_routes.twofa_setup_verify,
        _make_request(path="/auth/2fa/setup/verify"),
        Response(),
        TwoFASetupVerifyRequest(code=get_totp_code(setup_start_result["secret"])),
        user,
        db_session,
    )
    recovery_codes = setup_verify_result["recovery_codes"]
    assert len(recovery_codes) > 0

    login_twofa_response = Response()
    login_twofa_result = _call_unwrapped(
        auth_routes.login,
        _make_request(path="/auth/login"),
        login_twofa_response,
        UserLogin(email="challenge-flow@example.com", password="StrongP@ssw0rd"),
        db_session,
    )
    assert login_twofa_result["requires_2fa"] is True

    preauth_cookie_name = auth_routes._twofa_preauth_cookie_name()
    preauth_cookie_value = _cookie_from_response(login_twofa_response, preauth_cookie_name)
    assert preauth_cookie_value is not None

    invalid_request = _make_request(
        path="/auth/2fa/challenge/verify",
        cookies={preauth_cookie_name: preauth_cookie_value},
    )
    with pytest.raises(HTTPException) as invalid_exc:
        _call_unwrapped(
            auth_routes.twofa_challenge_verify,
            invalid_request,
            Response(),
            TwoFAChallengeVerifyRequest(
                code="000000",
                challenge_id=login_twofa_result["challenge_id"],
                use_recovery_code=False,
            ),
            db_session,
        )
    assert invalid_exc.value.status_code == 400

    valid_request = _make_request(
        path="/auth/2fa/challenge/verify",
        cookies={preauth_cookie_name: preauth_cookie_value},
    )
    valid_result = _call_unwrapped(
        auth_routes.twofa_challenge_verify,
        valid_request,
        Response(),
        TwoFAChallengeVerifyRequest(
            code=recovery_codes[0],
            challenge_id=login_twofa_result["challenge_id"],
            use_recovery_code=True,
        ),
        db_session,
    )
    assert valid_result["message"] == "2FA challenge verified successfully."
