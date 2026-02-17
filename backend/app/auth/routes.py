from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import re
from typing import Any

import httpx
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.service import create_access_token
from app.auth.schemas import (
    ChangePasswordRequest,
    MessageResponse,
    SetPasswordRequest,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdateProfile,
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
from app.db.models.user import User

router = APIRouter()

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_PROFILE_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"
OAUTH_STATE_TTL_SECONDS = 10 * 60


def _ensure_github_oauth_configured() -> None:
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured.",
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


def _frontend_oauth_callback_base_url() -> str:
    frontend_url = settings.FRONTEND_URL.strip() or "http://localhost:3000"
    return f"{frontend_url.rstrip('/')}/auth/oauth-callback"


def _build_frontend_oauth_redirect_url(
    *,
    provider: str,
    access_token: str | None = None,
    mode: str | None = None,
    error: str | None = None,
) -> str:
    payload: dict[str, str] = {"provider": provider}
    if mode in {"login", "signup"}:
        payload["mode"] = mode
    if access_token:
        payload["access_token"] = access_token
    if error:
        payload["error"] = error
    return f"{_frontend_oauth_callback_base_url()}#{urlencode(payload)}"


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

    return new_user  # FastAPI le convertit en UserResponse


@router.post("/login")
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

    # génération token
    access_token = create_access_token({"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


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
                    provider="github",
                    mode=mode,
                    error="Invalid OAuth state.",
                ),
                status_code=status.HTTP_302_FOUND,
            )

    if error:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                provider="github",
                mode=mode,
                error=error_description or error,
            ),
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
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

        access_token = create_access_token({"sub": db_user.email})
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                provider="github",
                mode=mode,
                access_token=access_token,
            ),
            status_code=status.HTTP_302_FOUND,
        )
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                provider="github",
                mode=mode,
                error=str(exc.detail),
            ),
            status_code=status.HTTP_302_FOUND,
        )
    except Exception:
        return RedirectResponse(
            url=_build_frontend_oauth_redirect_url(
                provider="github",
                mode=mode,
                error="GitHub OAuth failed.",
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
