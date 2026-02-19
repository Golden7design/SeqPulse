from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse
import re
from typing import Any
from uuid import UUID

import httpx
import structlog
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.service import create_access_token
from app.auth.schemas import (
    ChangePasswordRequest,
    LoginResponse,
    MessageResponse,
    SetPasswordRequest,
    TwoFAChallengeVerifyRequest,
    TwoFAChallengeSessionResponse,
    TwoFADisableRequest,
    TwoFARecoveryCodesResponse,
    TwoFARegenerateRecoveryCodesRequest,
    TwoFASetupStartResponse,
    TwoFASetupVerifyRequest,
    TwoFAStatusResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdateProfile,
)
from app.auth.twofa_service import (
    build_totp_uri,
    count_recovery_codes_remaining,
    encrypt_totp_secret,
    generate_recovery_codes,
    generate_totp_secret,
    verify_and_consume_recovery_code,
    verify_totp_code,
)
from app.core.rate_limit import RATE_LIMITS, limiter
from app.core.security import (
    build_oauth_placeholder_password,
    get_password_hash,
    has_local_password,
    verify_password,
)
from app.core.settings import settings
from app.db.deps import get_db
from app.db.models.auth_challenge import AuthChallenge
from app.db.models.user import User
from app.email.types import EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP, EMAIL_TYPE_WELCOME_SIGNUP
from app.scheduler.tasks import schedule_email

router = APIRouter()

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_PROFILE_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
OAUTH_STATE_TTL_SECONDS = 10 * 60
logger = structlog.get_logger(__name__)


def _is_local_hostname(hostname: str | None) -> bool:
    if not hostname:
        return False
    return hostname in {"localhost", "127.0.0.1", "::1"}


def _cookie_max_age_seconds() -> int:
    return max(60, settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)


def _cookie_samesite_value() -> str:
    configured = (settings.AUTH_COOKIE_SAMESITE or "lax").strip().lower()
    if configured in {"lax", "strict", "none"}:
        return configured
    return "lax"


def _set_auth_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=access_token,
        max_age=_cookie_max_age_seconds(),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=_cookie_samesite_value(),
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        samesite=_cookie_samesite_value(),
    )


def _twofa_preauth_cookie_name() -> str:
    configured = (getattr(settings, "AUTH_PREAUTH_COOKIE_NAME", "") or "").strip()
    return configured or "seqpulse_2fa_preauth"


def _twofa_preauth_ttl_seconds() -> int:
    ttl = int(getattr(settings, "TWOFA_PREAUTH_TTL_SECONDS", 300) or 300)
    return max(60, min(1800, ttl))


def _set_twofa_preauth_cookie(response: Response, preauth_token: str) -> None:
    response.set_cookie(
        key=_twofa_preauth_cookie_name(),
        value=preauth_token,
        max_age=_twofa_preauth_ttl_seconds(),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=_cookie_samesite_value(),
        path="/",
    )


def _clear_twofa_preauth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_twofa_preauth_cookie_name(),
        path="/",
        samesite=_cookie_samesite_value(),
    )


def _twofa_challenge_ttl_seconds() -> int:
    ttl = int(getattr(settings, "TWOFA_CHALLENGE_TTL_SECONDS", 300) or 300)
    return max(60, min(1800, ttl))


def _twofa_challenge_max_attempts() -> int:
    attempts = int(getattr(settings, "TWOFA_CHALLENGE_MAX_ATTEMPTS", 5) or 5)
    return max(3, min(10, attempts))


def _client_ip_value(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",", maxsplit=1)[0].strip()
        if first_ip:
            return first_ip[:64]

    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def _user_agent_value(request: Request) -> str | None:
    user_agent = (request.headers.get("user-agent") or "").strip()
    return user_agent[:512] if user_agent else None


def _user_requires_twofa(user: User) -> bool:
    return bool(user.twofa_enabled and user.twofa_secret_encrypted)


def _should_embed_oauth_access_token(request: Request | None) -> bool:
    if request is None:
        return False
    return _is_local_hostname(request.url.hostname)


def _audit_twofa_event(
    event_name: str,
    *,
    request: Request | None = None,
    user: User | None = None,
    challenge: AuthChallenge | None = None,
    outcome: str = "success",
    use_recovery_code: bool = False,
    reason: str | None = None,
) -> None:
    logger.info(
        "twofa.audit",
        audit_event=event_name,
        outcome=outcome,
        user_id=str(user.id) if user is not None else None,
        challenge_id=str(challenge.id) if challenge is not None else None,
        use_recovery_code=use_recovery_code,
        ip=_client_ip_value(request) if request is not None else None,
        reason=reason,
    )


def _create_twofa_login_challenge(db: Session, user: User, request: Request) -> AuthChallenge:
    now = datetime.now(timezone.utc)
    challenge = AuthChallenge(
        user_id=user.id,
        kind="2fa_login",
        expires_at=now + timedelta(seconds=_twofa_challenge_ttl_seconds()),
        max_attempts=_twofa_challenge_max_attempts(),
        ip=_client_ip_value(request),
        user_agent=_user_agent_value(request),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


def _create_twofa_preauth_token(*, user: User, challenge: AuthChallenge) -> str:
    payload: dict[str, Any] = {
        "type": "2fa_preauth",
        "sub": str(user.id),
        "challenge_id": str(challenge.id),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=_twofa_preauth_ttl_seconds()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_twofa_preauth_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA pre-auth session.",
        ) from exc

    if payload.get("type") != "2fa_preauth":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA pre-auth session.",
        )

    return payload


def _ensure_github_oauth_configured() -> None:
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured.",
        )


def _ensure_google_oauth_configured() -> None:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )


def _build_oauth_state(provider: str, mode: str | None) -> str:
    payload: dict[str, Any] = {
        "provider": provider,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=OAUTH_STATE_TTL_SECONDS),
    }
    if mode in {"login", "signup"}:
        payload["mode"] = mode
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_oauth_state(state_token: str, provider: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            state_token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state.",
        ) from exc

    if payload.get("provider") != provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider mismatch.",
        )

    return payload


def _frontend_oauth_callback_base_url(request: Request | None = None) -> str:
    frontend_url = settings.FRONTEND_URL.strip() or "http://localhost:3000"
    normalized = frontend_url.rstrip("/")

    if request is not None:
        request_host = request.url.hostname
        parsed = urlparse(normalized)
        configured_host = parsed.hostname
        if (
            _is_local_hostname(request_host)
            and _is_local_hostname(configured_host)
            and request_host
            and configured_host
            and request_host != configured_host
        ):
            scheme = parsed.scheme or request.url.scheme or "http"
            port = parsed.port or 3000
            return f"{scheme}://{request_host}:{port}/auth/oauth-callback"

    return f"{normalized}/auth/oauth-callback"


def _build_frontend_oauth_redirect_url(
    *,
    request: Request | None = None,
    provider: str,
    mode: str | None = None,
    error: str | None = None,
    requires_2fa: bool = False,
    challenge_id: UUID | None = None,
    challenge_expires_at: datetime | None = None,
    access_token: str | None = None,
) -> str:
    payload: dict[str, str] = {"provider": provider}
    if mode in {"login", "signup"}:
        payload["mode"] = mode
    if error:
        payload["error"] = error
    if requires_2fa:
        payload["requires_2fa"] = "1"
    if challenge_id is not None:
        payload["challenge_id"] = str(challenge_id)
    if challenge_expires_at is not None:
        expires_at_value = challenge_expires_at
        if expires_at_value.tzinfo is None:
            expires_at_value = expires_at_value.replace(tzinfo=timezone.utc)
        payload["challenge_expires_at"] = expires_at_value.astimezone(timezone.utc).isoformat()
    if access_token:
        payload["access_token"] = access_token
    base_url = _frontend_oauth_callback_base_url(request=request)
    query_payload = {key: value for key, value in payload.items() if key != "access_token"}
    if access_token:
        # Local/dev fallback: make token available even if fragment is dropped by a proxy/browser edge case.
        query_payload["access_token"] = access_token
    query = urlencode(query_payload)
    fragment = urlencode(payload)
    return f"{base_url}?{query}#{fragment}"


def _normalize_github_login(login: str | None) -> str:
    raw = (login or "github-user").strip().lower()
    normalized = re.sub(r"[^a-z0-9-]", "", raw)
    return normalized or "github-user"


def _extract_github_email(profile: dict[str, Any], emails: list[dict[str, Any]]) -> str:
    verified_primary = next(
        (
            item.get("email")
            for item in emails
            if item.get("email") and item.get("verified") and item.get("primary")
        ),
        None,
    )
    if verified_primary:
        return str(verified_primary).lower()

    verified_any = next(
        (item.get("email") for item in emails if item.get("email") and item.get("verified")),
        None,
    )
    if verified_any:
        return str(verified_any).lower()

    if not emails and profile.get("email"):
        return str(profile["email"]).lower()

    github_id = profile.get("id")
    github_login = _normalize_github_login(profile.get("login"))
    if github_id:
        return f"{github_id}+{github_login}@users.noreply.github.com"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="GitHub account has no usable email address.",
    )


def _extract_github_name(profile: dict[str, Any], fallback_email: str) -> str:
    name = str(profile.get("name") or "").strip()
    if name:
        return name
    login = str(profile.get("login") or "").strip()
    if login:
        return login
    local_part = fallback_email.split("@", maxsplit=1)[0].replace(".", " ").replace("-", " ")
    return local_part[:50] or "GitHub User"


def _extract_google_email(profile: dict[str, Any]) -> str:
    email = profile.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no usable email address.",
        )
    email_verified = profile.get("email_verified")
    if email_verified is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google email is not verified.",
        )
    return str(email).lower()


def _extract_google_name(profile: dict[str, Any], fallback_email: str) -> str:
    name = str(profile.get("name") or "").strip()
    if name:
        return name
    given_name = str(profile.get("given_name") or "").strip()
    family_name = str(profile.get("family_name") or "").strip()
    combined = f"{given_name} {family_name}".strip()
    if combined:
        return combined
    local_part = fallback_email.split("@", maxsplit=1)[0].replace(".", " ").replace("-", " ")
    return local_part[:50] or "Google User"


def _first_name_value(name: str | None, fallback_email: str) -> str:
    normalized = (name or "").strip()
    if normalized:
        return normalized.split(" ", maxsplit=1)[0][:50]
    return fallback_email.split("@", maxsplit=1)[0][:50] or "there"


def _schedule_signup_lifecycle_emails(db: Session, user: User) -> None:
    first_name = _first_name_value(user.name, user.email)
    base_context = {"first_name": first_name}

    try:
        schedule_email(
            db,
            user_id=user.id,
            to_email=user.email,
            email_type=EMAIL_TYPE_WELCOME_SIGNUP,
            dedupe_key=f"welcome_signup:{user.id}",
            context=base_context,
            scheduled_at=None,
        )
        schedule_email(
            db,
            user_id=user.id,
            to_email=user.email,
            email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
            dedupe_key=f"no_project_after_signup:{user.id}",
            context=base_context,
            scheduled_at=datetime.now(timezone.utc) + timedelta(hours=2),
        )
    except Exception as exc:
        logger.warning(
            "signup_email_schedule_failed",
            user_id=str(user.id),
            email=user.email,
            error=str(exc),
        )


def _find_or_create_oauth_user(db: Session, email: str, name: str) -> User:
    db_user = db.query(User).filter(User.email == email).first()
    if db_user is None:
        db_user = User(
            name=name[:50],
            email=email,
            hashed_password=build_oauth_placeholder_password(),
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        _schedule_signup_lifecycle_emails(db, db_user)
    return db_user


async def _exchange_github_code_for_token(code: str, redirect_uri: str) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

    if token_response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange GitHub OAuth code.",
        )

    token_payload = token_response.json()
    if token_payload.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=token_payload.get("error_description") or "GitHub OAuth authorization failed.",
        )

    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth token missing.",
        )

    return str(access_token)


async def _exchange_google_code_for_token(code: str, redirect_uri: str) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

    if token_response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange Google OAuth code.",
        )

    token_payload = token_response.json()
    if token_payload.get("error"):
        error_value = token_payload.get("error_description") or token_payload.get("error")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error_value),
        )

    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth token missing.",
        )

    return str(access_token)


async def _fetch_github_profile_data(github_token: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        profile_response = await client.get(GITHUB_PROFILE_URL, headers=headers)
        emails_response = await client.get(GITHUB_EMAILS_URL, headers=headers)

    if profile_response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch GitHub profile.",
        )
    if emails_response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch GitHub emails.",
        )

    profile = profile_response.json()
    emails_payload = emails_response.json()
    emails = emails_payload if isinstance(emails_payload, list) else []
    return profile, emails


async def _fetch_google_profile_data(google_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        profile_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={
                "Authorization": f"Bearer {google_token}",
                "Accept": "application/json",
            },
        )

    if profile_response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Google profile.",
        )

    payload = profile_response.json()
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid Google profile payload.",
        )
    return payload


def _twofa_digits() -> int:
    digits = int(getattr(settings, "TWOFA_CODE_DIGITS", 6) or 6)
    return max(6, min(8, digits))


def _twofa_period_seconds() -> int:
    period = int(getattr(settings, "TWOFA_PERIOD_SECONDS", 30) or 30)
    return max(15, min(120, period))


def _twofa_issuer_value() -> str:
    issuer = (getattr(settings, "TWOFA_ISSUER", "SEQPULSE") or "SEQPULSE").strip()
    return issuer or "SEQPULSE"


def _challenge_is_expired(challenge: AuthChallenge, now: datetime) -> bool:
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def _verify_twofa_factor(
    *,
    user: User,
    code: str,
    use_recovery_code: bool,
    now: datetime,
) -> bool:
    if use_recovery_code:
        return verify_and_consume_recovery_code(user=user, code=code, for_time=now)
    return verify_totp_code(user=user, code=code, for_time=now)


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMITS["auth"])
def signup(request: Request, response: Response, user_in: UserCreate, db: Session = Depends(get_db)):
    # Vérifier l'email
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email déjà utilisé.",
        )

    # Créer l'utilisateur
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    _schedule_signup_lifecycle_emails(db, new_user)

    return new_user  # FastAPI le convertit en UserResponse


@router.post("/login", response_model=LoginResponse)
@limiter.limit(RATE_LIMITS["auth"])
def login(request: Request, response: Response, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if _user_requires_twofa(db_user):
        challenge = _create_twofa_login_challenge(db=db, user=db_user, request=request)
        preauth_token = _create_twofa_preauth_token(user=db_user, challenge=challenge)
        _audit_twofa_event(
            "login_challenge_created",
            request=request,
            user=db_user,
            challenge=challenge,
        )
        _clear_auth_cookie(response)
        _set_twofa_preauth_cookie(response, preauth_token)
        return {
            "access_token": None,
            "token_type": "bearer",
            "requires_2fa": True,
            "challenge_id": challenge.id,
            "challenge_expires_at": challenge.expires_at,
        }

    # génération token
    access_token = create_access_token({"sub": db_user.email})
    _clear_twofa_preauth_cookie(response)
    _set_auth_cookie(response, access_token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "challenge_id": None,
        "challenge_expires_at": None,
    }


@router.get("/oauth/github/start", name="oauth_github_start")
@limiter.limit(RATE_LIMITS["auth"])
def oauth_github_start(
    request: Request,
    response: Response,
    mode: str | None = None,
):
    try:
        _ensure_github_oauth_configured()
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                error=str(exc.detail),
            ),
            status_code=status.HTTP_302_FOUND,
        )

    state = _build_oauth_state(provider="github", mode=mode)
    redirect_uri = str(request.url_for("oauth_github_callback"))
    authorize_params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
        "state": state,
    }
    authorize_url = f"{GITHUB_AUTHORIZE_URL}?{urlencode(authorize_params)}"
    return RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/oauth/github/callback", name="oauth_github_callback")
@limiter.limit(RATE_LIMITS["auth"])
async def oauth_github_callback(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    mode: str | None = None
    if state:
        try:
            state_payload = _decode_oauth_state(state, provider="github")
            state_mode = state_payload.get("mode")
            if isinstance(state_mode, str) and state_mode in {"login", "signup"}:
                mode = state_mode
        except HTTPException:
            return RedirectResponse(
                url=_build_frontend_oauth_redirect_url(
                    request=request,
                    provider="github",
                    mode=mode,
                    error="Invalid OAuth state.",
                ),
                status_code=status.HTTP_302_FOUND,
            )

    if error:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                error=error_description or error,
            ),
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                error="Missing GitHub OAuth code.",
            ),
            status_code=status.HTTP_302_FOUND,
        )

    try:
        _ensure_github_oauth_configured()
        if not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing OAuth state.",
            )
        _decode_oauth_state(state, provider="github")

        redirect_uri = str(request.url_for("oauth_github_callback"))
        github_token = await _exchange_github_code_for_token(code, redirect_uri)
        github_profile, github_emails = await _fetch_github_profile_data(github_token)

        email = _extract_github_email(github_profile, github_emails)
        name = _extract_github_name(github_profile, email)
        db_user = _find_or_create_oauth_user(db, email, name)

        if _user_requires_twofa(db_user):
            challenge = _create_twofa_login_challenge(db=db, user=db_user, request=request)
            preauth_token = _create_twofa_preauth_token(user=db_user, challenge=challenge)
            _audit_twofa_event(
                "oauth_github_challenge_created",
                request=request,
                user=db_user,
                challenge=challenge,
            )
            frontend_redirect = RedirectResponse(
                url=_build_frontend_oauth_redirect_url(
                    request=request,
                    provider="github",
                    mode=mode,
                    requires_2fa=True,
                    challenge_id=challenge.id,
                    challenge_expires_at=challenge.expires_at,
                ),
                status_code=status.HTTP_302_FOUND,
            )
            _clear_auth_cookie(frontend_redirect)
            _set_twofa_preauth_cookie(frontend_redirect, preauth_token)
            return frontend_redirect

        access_token = create_access_token({"sub": db_user.email})
        frontend_redirect = RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                access_token=access_token if _should_embed_oauth_access_token(request) else None,
            ),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_twofa_preauth_cookie(frontend_redirect)
        _set_auth_cookie(frontend_redirect, access_token)
        return frontend_redirect
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                error=str(exc.detail),
            ),
            status_code=status.HTTP_302_FOUND,
        )
    except Exception:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="github",
                mode=mode,
                error="GitHub OAuth failed.",
            ),
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/oauth/google/start", name="oauth_google_start")
@limiter.limit(RATE_LIMITS["auth"])
def oauth_google_start(
    request: Request,
    response: Response,
    mode: str | None = None,
):
    try:
        _ensure_google_oauth_configured()
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                error=str(exc.detail),
            ),
            status_code=status.HTTP_302_FOUND,
        )

    state = _build_oauth_state(provider="google", mode=mode)
    redirect_uri = str(request.url_for("oauth_google_callback"))
    authorize_params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "access_type": "online",
    }
    authorize_url = f"{GOOGLE_AUTHORIZE_URL}?{urlencode(authorize_params)}"
    return RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/oauth/google/callback", name="oauth_google_callback")
@limiter.limit(RATE_LIMITS["auth"])
async def oauth_google_callback(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    mode: str | None = None
    if state:
        try:
            state_payload = _decode_oauth_state(state, provider="google")
            state_mode = state_payload.get("mode")
            if isinstance(state_mode, str) and state_mode in {"login", "signup"}:
                mode = state_mode
        except HTTPException:
            return RedirectResponse(
                url=_build_frontend_oauth_redirect_url(
                    request=request,
                    provider="google",
                    mode=mode,
                    error="Invalid OAuth state.",
                ),
                status_code=status.HTTP_302_FOUND,
            )

    if error:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                error=error_description or error,
            ),
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                error="Missing Google OAuth code.",
            ),
            status_code=status.HTTP_302_FOUND,
        )

    try:
        _ensure_google_oauth_configured()
        if not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing OAuth state.",
            )
        _decode_oauth_state(state, provider="google")

        redirect_uri = str(request.url_for("oauth_google_callback"))
        google_token = await _exchange_google_code_for_token(code, redirect_uri)
        google_profile = await _fetch_google_profile_data(google_token)

        email = _extract_google_email(google_profile)
        name = _extract_google_name(google_profile, email)
        db_user = _find_or_create_oauth_user(db, email, name)

        if _user_requires_twofa(db_user):
            challenge = _create_twofa_login_challenge(db=db, user=db_user, request=request)
            preauth_token = _create_twofa_preauth_token(user=db_user, challenge=challenge)
            _audit_twofa_event(
                "oauth_google_challenge_created",
                request=request,
                user=db_user,
                challenge=challenge,
            )
            frontend_redirect = RedirectResponse(
                url=_build_frontend_oauth_redirect_url(
                    request=request,
                    provider="google",
                    mode=mode,
                    requires_2fa=True,
                    challenge_id=challenge.id,
                    challenge_expires_at=challenge.expires_at,
                ),
                status_code=status.HTTP_302_FOUND,
            )
            _clear_auth_cookie(frontend_redirect)
            _set_twofa_preauth_cookie(frontend_redirect, preauth_token)
            return frontend_redirect

        access_token = create_access_token({"sub": db_user.email})
        frontend_redirect = RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                access_token=access_token if _should_embed_oauth_access_token(request) else None,
            ),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_twofa_preauth_cookie(frontend_redirect)
        _set_auth_cookie(frontend_redirect, access_token)
        return frontend_redirect
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                error=str(exc.detail),
            ),
            status_code=status.HTTP_302_FOUND,
        )
    except Exception:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                request=request,
                provider="google",
                mode=mode,
                error="Google OAuth failed.",
            ),
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "name": current_user.name,
        "has_password": has_local_password(current_user.hashed_password),
    }


@router.patch("/me", response_model=UserResponse)
@limiter.limit(RATE_LIMITS["dashboard"])
def update_me(
    request: Request,
    response: Response,
    payload: UserUpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = payload.name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit(RATE_LIMITS["auth"])
def change_password(
    request: Request,
    response: Response,
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not has_local_password(current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No local password is set for this account. Use set-password first.",
        )

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()

    return {"message": "Password updated successfully."}


@router.post("/set-password", response_model=MessageResponse)
@limiter.limit(RATE_LIMITS["auth"])
def set_password(
    request: Request,
    response: Response,
    payload: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if has_local_password(current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is already set for this account. Use change-password.",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()

    return {"message": "Password set successfully."}


@router.get("/2fa/status", response_model=TwoFAStatusResponse)
@limiter.limit(RATE_LIMITS["dashboard"])
def twofa_status(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    return {
        "enabled": bool(current_user.twofa_enabled),
        "has_setup_secret": bool(current_user.twofa_secret_encrypted),
        "recovery_codes_remaining": count_recovery_codes_remaining(current_user),
    }


@router.post("/2fa/setup/start", response_model=TwoFASetupStartResponse)
@limiter.limit(RATE_LIMITS["twofa_setup_start"])
def twofa_setup_start(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.twofa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled on this account.",
        )

    secret = generate_totp_secret()
    encrypted_secret = encrypt_totp_secret(secret)

    current_user.twofa_secret_encrypted = encrypted_secret
    current_user.twofa_recovery_codes_hash = None
    current_user.twofa_last_totp_step = None
    current_user.twofa_enabled_at = None
    current_user.twofa_last_verified_at = None
    db.add(current_user)
    db.commit()
    _audit_twofa_event(
        "setup_started",
        request=request,
        user=current_user,
    )

    issuer = _twofa_issuer_value()
    return {
        "secret": secret,
        "otpauth_uri": build_totp_uri(
            secret=secret,
            account_name=current_user.email,
            issuer=issuer,
        ),
        "issuer": issuer,
        "digits": _twofa_digits(),
        "period": _twofa_period_seconds(),
    }


@router.post("/2fa/setup/verify", response_model=TwoFARecoveryCodesResponse)
@limiter.limit(RATE_LIMITS["twofa_setup_verify"])
def twofa_setup_verify(
    request: Request,
    response: Response,
    payload: TwoFASetupVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.twofa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled on this account.",
        )

    if not current_user.twofa_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA setup was not started. Call /auth/2fa/setup/start first.",
        )

    now = datetime.now(timezone.utc)
    if not verify_totp_code(user=current_user, code=payload.code, for_time=now):
        _audit_twofa_event(
            "setup_verify_failed",
            request=request,
            user=current_user,
            outcome="failure",
            reason="invalid_code",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA code.",
        )

    plain_recovery_codes, hashed_recovery_codes = generate_recovery_codes()
    current_user.twofa_enabled = True
    current_user.twofa_enabled_at = now
    current_user.twofa_recovery_codes_hash = hashed_recovery_codes
    db.add(current_user)
    db.commit()
    _audit_twofa_event(
        "setup_verified",
        request=request,
        user=current_user,
    )

    return {
        "message": "2FA enabled successfully.",
        "recovery_codes": plain_recovery_codes,
        "recovery_codes_remaining": len(hashed_recovery_codes),
    }


@router.get("/2fa/challenge/session", response_model=TwoFAChallengeSessionResponse)
@limiter.limit(RATE_LIMITS["auth"])
def twofa_challenge_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    preauth_cookie = request.cookies.get(_twofa_preauth_cookie_name())
    if not preauth_cookie:
        return {
            "requires_2fa": False,
            "challenge_id": None,
            "challenge_expires_at": None,
        }

    try:
        preauth_payload = _decode_twofa_preauth_token(preauth_cookie)
        preauth_user_id = UUID(str(preauth_payload.get("sub")))
        preauth_challenge_id = UUID(str(preauth_payload.get("challenge_id")))
    except (HTTPException, TypeError, ValueError):
        _clear_twofa_preauth_cookie(response)
        return {
            "requires_2fa": False,
            "challenge_id": None,
            "challenge_expires_at": None,
        }

    challenge = (
        db.query(AuthChallenge)
        .filter(
            AuthChallenge.id == preauth_challenge_id,
            AuthChallenge.kind == "2fa_login",
            AuthChallenge.user_id == preauth_user_id,
        )
        .first()
    )
    if challenge is None:
        _clear_twofa_preauth_cookie(response)
        return {
            "requires_2fa": False,
            "challenge_id": None,
            "challenge_expires_at": None,
        }

    now = datetime.now(timezone.utc)
    if challenge.consumed_at is not None or _challenge_is_expired(challenge, now):
        _clear_twofa_preauth_cookie(response)
        return {
            "requires_2fa": False,
            "challenge_id": None,
            "challenge_expires_at": None,
        }

    user = db.query(User).filter(User.id == challenge.user_id).first()
    if user is None or not _user_requires_twofa(user):
        _clear_twofa_preauth_cookie(response)
        return {
            "requires_2fa": False,
            "challenge_id": None,
            "challenge_expires_at": None,
        }

    return {
        "requires_2fa": True,
        "challenge_id": challenge.id,
        "challenge_expires_at": challenge.expires_at,
    }


@router.post("/2fa/challenge/verify", response_model=MessageResponse)
@limiter.limit(RATE_LIMITS["twofa_challenge_verify"])
def twofa_challenge_verify(
    request: Request,
    response: Response,
    payload: TwoFAChallengeVerifyRequest,
    db: Session = Depends(get_db),
):
    preauth_cookie = request.cookies.get(_twofa_preauth_cookie_name())
    if not preauth_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA pre-auth session is missing. Restart login.",
        )

    preauth_payload = _decode_twofa_preauth_token(preauth_cookie)
    try:
        preauth_user_id = UUID(str(preauth_payload.get("sub")))
        preauth_challenge_id = UUID(str(preauth_payload.get("challenge_id")))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA pre-auth session.",
        ) from exc

    if payload.challenge_id and payload.challenge_id != preauth_challenge_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA challenge does not match the active pre-auth session.",
        )

    challenge = (
        db.query(AuthChallenge)
        .filter(
            AuthChallenge.id == preauth_challenge_id,
            AuthChallenge.kind == "2fa_login",
        )
        .first()
    )
    if challenge is None:
        _clear_twofa_preauth_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="2FA challenge not found.",
        )

    if challenge.user_id != preauth_user_id:
        _clear_twofa_preauth_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA pre-auth session.",
        )

    now = datetime.now(timezone.utc)
    if challenge.consumed_at is not None:
        _clear_twofa_preauth_cookie(response)
        _audit_twofa_event(
            "challenge_verify_failed",
            request=request,
            challenge=challenge,
            outcome="failure",
            reason="already_consumed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA challenge was already used.",
        )
    if _challenge_is_expired(challenge, now):
        _clear_twofa_preauth_cookie(response)
        _audit_twofa_event(
            "challenge_verify_failed",
            request=request,
            challenge=challenge,
            outcome="failure",
            reason="challenge_expired",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA challenge has expired.",
        )
    if challenge.attempt_count >= challenge.max_attempts:
        _clear_twofa_preauth_cookie(response)
        _audit_twofa_event(
            "challenge_verify_failed",
            request=request,
            challenge=challenge,
            outcome="failure",
            reason="max_attempts_reached",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid attempts for this 2FA challenge.",
        )

    user = db.query(User).filter(User.id == challenge.user_id).first()
    if user is None:
        _clear_twofa_preauth_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User for this 2FA challenge was not found.",
        )
    if not user.twofa_enabled or not user.twofa_secret_encrypted:
        _clear_twofa_preauth_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled on this account.",
        )

    is_valid = _verify_twofa_factor(
        user=user,
        code=payload.code,
        use_recovery_code=payload.use_recovery_code,
        now=now,
    )
    if not is_valid:
        challenge.attempt_count += 1
        db.add(challenge)
        db.commit()
        _audit_twofa_event(
            "challenge_verify_failed",
            request=request,
            user=user,
            challenge=challenge,
            outcome="failure",
            use_recovery_code=payload.use_recovery_code,
            reason="invalid_factor",
        )
        if challenge.attempt_count >= challenge.max_attempts:
            _clear_twofa_preauth_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many invalid attempts for this 2FA challenge.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA code.",
        )

    challenge.consumed_at = now
    db.add(challenge)
    db.add(user)
    db.commit()
    _audit_twofa_event(
        "challenge_verified",
        request=request,
        user=user,
        challenge=challenge,
        use_recovery_code=payload.use_recovery_code,
    )

    access_token = create_access_token({"sub": user.email})
    _clear_twofa_preauth_cookie(response)
    _set_auth_cookie(response, access_token)
    return {"message": "2FA challenge verified successfully."}


@router.post("/2fa/disable", response_model=MessageResponse)
@limiter.limit(RATE_LIMITS["twofa_sensitive"])
def twofa_disable(
    request: Request,
    response: Response,
    payload: TwoFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.twofa_enabled or not current_user.twofa_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled on this account.",
        )

    now = datetime.now(timezone.utc)
    if not _verify_twofa_factor(
        user=current_user,
        code=payload.code,
        use_recovery_code=payload.use_recovery_code,
        now=now,
    ):
        _audit_twofa_event(
            "disable_failed",
            request=request,
            user=current_user,
            outcome="failure",
            use_recovery_code=payload.use_recovery_code,
            reason="invalid_factor",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA code.",
        )

    current_user.twofa_enabled = False
    current_user.twofa_secret_encrypted = None
    current_user.twofa_enabled_at = None
    current_user.twofa_last_verified_at = None
    current_user.twofa_recovery_codes_hash = None
    current_user.twofa_last_totp_step = None
    db.add(current_user)
    db.commit()
    _audit_twofa_event(
        "disabled",
        request=request,
        user=current_user,
        use_recovery_code=payload.use_recovery_code,
    )

    return {"message": "2FA disabled successfully."}


@router.post("/2fa/recovery-codes/regenerate", response_model=TwoFARecoveryCodesResponse)
@limiter.limit(RATE_LIMITS["twofa_sensitive"])
def twofa_regenerate_recovery_codes(
    request: Request,
    response: Response,
    payload: TwoFARegenerateRecoveryCodesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.twofa_enabled or not current_user.twofa_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled on this account.",
        )

    now = datetime.now(timezone.utc)
    if not _verify_twofa_factor(
        user=current_user,
        code=payload.code,
        use_recovery_code=payload.use_recovery_code,
        now=now,
    ):
        _audit_twofa_event(
            "recovery_regenerate_failed",
            request=request,
            user=current_user,
            outcome="failure",
            use_recovery_code=payload.use_recovery_code,
            reason="invalid_factor",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA code.",
        )

    plain_recovery_codes, hashed_recovery_codes = generate_recovery_codes()
    current_user.twofa_recovery_codes_hash = hashed_recovery_codes
    db.add(current_user)
    db.commit()
    _audit_twofa_event(
        "recovery_regenerated",
        request=request,
        user=current_user,
        use_recovery_code=payload.use_recovery_code,
    )

    return {
        "message": "Recovery codes regenerated successfully.",
        "recovery_codes": plain_recovery_codes,
        "recovery_codes_remaining": len(hashed_recovery_codes),
    }


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    _clear_auth_cookie(response)
    _clear_twofa_preauth_cookie(response)
    return {"message": "Logged out successfully."}
