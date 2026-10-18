import logging
from ipaddress import ip_address

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.errors import AppError, NotAuthenticated
from app.core.ratelimit import (
    LOGIN_PER_EMAIL,
    LOGIN_PER_IP,
    RESET_PER_EMAIL,
    RESET_PER_IP,
    SIGNUP_PER_IP,
    limiter,
)
from app.integrations.storage.base import get_storage
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser, DbSession
from app.modules.auth.google import google_client
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    DeleteAccountIn,
    LoginIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    SignupIn,
    UserOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        raw,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,
        secure=not settings.is_local,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        settings.session_cookie_name, domain=settings.session_cookie_domain, path="/"
    )


def _client_ip(request: Request) -> str | None:
    # request.client.host is not always an IP (test clients, unix sockets).
    host = request.client.host if request.client else None
    try:
        return str(ip_address(host)) if host else None
    except ValueError:
        return None


async def _start_session(db: DbSession, request: Request, response: Response, user: User) -> None:
    raw = await service.create_session(
        db, user, user_agent=request.headers.get("user-agent"), ip=_client_ip(request)
    )
    await db.commit()
    _set_session_cookie(response, raw)


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn, request: Request, response: Response, db: DbSession) -> User:
    limiter.hit(SIGNUP_PER_IP, _client_ip(request) or "unknown")
    user = await service.signup(db, body.email, body.password)
    await _start_session(db, request, response, user)
    return user


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, request: Request, response: Response, db: DbSession) -> User:
    limiter.hit(LOGIN_PER_IP, _client_ip(request) or "unknown")
    limiter.hit(LOGIN_PER_EMAIL, body.email.lower())
    user = await service.authenticate(db, body.email, body.password)
    if user is None:
        raise NotAuthenticated("Wrong email or password.", code="invalid_credentials")
    await _start_session(db, request, response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: DbSession) -> None:
    raw = request.cookies.get(get_settings().session_cookie_name)
    if raw:
        await service.revoke_session(db, raw)
        await db.commit()
    _clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountIn, user: CurrentUser, response: Response, db: DbSession
) -> None:
    """Settings > Data > Delete my account. The user types DELETE to confirm."""
    # Files first: if storage fails, the account (and the way to retry) still exists.
    await get_storage().delete_prefix(str(user.id))
    await db.delete(user)  # cascades to profile, sessions, tokens, resumes, jobs
    await db.commit()
    _clear_session_cookie(response)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def password_reset_request(
    body: PasswordResetRequestIn, request: Request, db: DbSession
) -> dict[str, str]:
    limiter.hit(RESET_PER_IP, _client_ip(request) or "unknown")
    limiter.hit(RESET_PER_EMAIL, body.email.lower())
    await service.request_password_reset(db, body.email)
    # Same answer whether or not the account exists.
    return {"status": "If that email has an account, a reset link is on its way."}


@router.post("/password-reset/confirm", response_model=UserOut)
async def password_reset_confirm(
    body: PasswordResetConfirmIn, request: Request, response: Response, db: DbSession
) -> User:
    user = await service.reset_password(db, body.token, body.password)
    await _start_session(db, request, response, user)
    return user


@router.get("/google/login")
async def google_login(request: Request):
    client = google_client()
    redirect_uri = get_settings().google_redirect_uri or str(request.url_for("google_callback"))
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: DbSession) -> RedirectResponse:
    settings = get_settings()
    client = google_client()
    try:
        token = await client.authorize_access_token(request)
    except OAuthError as exc:
        logger.warning("google callback: oauth error %s: %s", exc.error, exc.description)
        return RedirectResponse(f"{settings.frontend_origin}/login?error=google")

    info = token.get("userinfo") or {}
    try:
        user = await service.login_with_google(
            db,
            service.GoogleProfile(
                subject=info["sub"],
                email=info["email"],
                email_verified=bool(info.get("email_verified")),
                picture=info.get("picture"),
            ),
        )
    except (KeyError, AppError) as exc:
        logger.warning("google callback: could not sign in: %r", exc)
        await db.rollback()
        return RedirectResponse(f"{settings.frontend_origin}/login?error=google")

    response = RedirectResponse(f"{settings.frontend_origin}/")
    await _start_session(db, request, response, user)
    return response
