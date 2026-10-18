from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, Conflict
from app.core.security import (
    hash_password,
    hash_token,
    new_token,
    password_needs_rehash,
    verify_password,
)
from app.integrations.notifications.base import EmailMessage, get_email_sender
from app.modules.auth.models import (
    AuthIdentity,
    AuthProvider,
    AuthToken,
    AuthTokenPurpose,
    User,
    UserSession,
)
from app.modules.profiles.service import create_empty_profile

# Refresh last_seen_at / expires_at at most this often, so not every request writes a row.
SESSION_TOUCH_INTERVAL = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


# ---------------------------------------------------------------- email + password


async def signup(db: AsyncSession, email: str, password: str) -> User:
    user = User(email=_normalize_email(email), password_hash=hash_password(password))
    db.add(user)
    try:
        await db.flush()
        create_empty_profile(db, user.id)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise Conflict("An account with this email already exists.", code="email_taken") from exc
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await db.scalar(select(User).where(User.email == _normalize_email(email)))
    if user is None or user.password_hash is None:
        # Hash anyway so response time does not reveal whether the email exists.
        hash_password(password)
        return None
    if not verify_password(user.password_hash, password):
        return None
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    return user


# ---------------------------------------------------------------- sessions


async def create_session(
    db: AsyncSession, user: User, *, user_agent: str | None, ip: str | None
) -> str:
    """Create a session row and return the raw token for the cookie."""
    raw, token_hash = new_token()
    now = _now()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(days=get_settings().session_ttl_days),
            user_agent=(user_agent or "")[:500] or None,
            ip=ip,
        )
    )
    user.last_login_at = now
    await db.flush()
    return raw


async def user_from_session_token(db: AsyncSession, raw: str) -> User | None:
    now = _now()
    row = (
        await db.execute(
            select(UserSession, User)
            .join(User, User.id == UserSession.user_id)
            .where(
                UserSession.token_hash == hash_token(raw),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
            )
        )
    ).first()
    if row is None:
        return None
    session, user = row
    # Sliding expiry: active users stay logged in.
    if now - session.last_seen_at > SESSION_TOUCH_INTERVAL:
        session.last_seen_at = now
        session.expires_at = now + timedelta(days=get_settings().session_ttl_days)
        await db.commit()
    return user


async def revoke_session(db: AsyncSession, raw: str) -> None:
    await db.execute(
        update(UserSession)
        .where(UserSession.token_hash == hash_token(raw), UserSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


async def revoke_all_sessions(db: AsyncSession, user_id) -> None:
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


# ---------------------------------------------------------------- password reset


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Email a reset link if the account exists. Silent otherwise (no account enumeration)."""
    settings = get_settings()
    user = await db.scalar(select(User).where(User.email == _normalize_email(email)))
    if user is None:
        return

    # Only the newest link works.
    now = _now()
    await db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.password_reset,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw, token_hash = new_token()
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=AuthTokenPurpose.password_reset,
            token_hash=token_hash,
            expires_at=now + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await db.commit()

    link = f"{settings.frontend_origin}/reset-password?token={raw}"
    await get_email_sender().send(
        EmailMessage(
            to=user.email,
            subject="Reset your Job Hunt Companion password",
            text=(
                f"Use this link to set a new password:\n\n{link}\n\n"
                f"It expires in {settings.password_reset_ttl_minutes} minutes. "
                "If you did not ask for this, ignore this email."
            ),
        )
    )


async def reset_password(db: AsyncSession, raw: str, new_password: str) -> User:
    now = _now()
    token = await db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_token(raw),
            AuthToken.purpose == AuthTokenPurpose.password_reset,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > now,
        )
    )
    if token is None:
        raise AppError("This reset link is invalid or has expired.", code="invalid_token")

    user = await db.get(User, token.user_id)
    user.password_hash = hash_password(new_password)
    token.used_at = now
    # Log out every device after a password change.
    await revoke_all_sessions(db, user.id)
    return user


# ---------------------------------------------------------------- Google


@dataclass(frozen=True)
class GoogleProfile:
    subject: str
    email: str
    email_verified: bool
    picture: str | None


async def login_with_google(db: AsyncSession, profile: GoogleProfile) -> User:
    now = _now()
    identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == AuthProvider.google,
            AuthIdentity.provider_subject == profile.subject,
        )
    )
    if identity is not None:
        identity.last_used_at = now
        identity.provider_email = profile.email
        return await db.get(User, identity.user_id)

    if not profile.email_verified:
        raise AppError("Your Google email is not verified.", code="google_email_unverified")

    email = _normalize_email(profile.email)
    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, email_verified_at=now, avatar_url=profile.picture)
        db.add(user)
        await db.flush()
        create_empty_profile(db, user.id)
    else:
        # Same verified email as an existing password account: link it (schema default).
        user.email_verified_at = user.email_verified_at or now
        user.avatar_url = user.avatar_url or profile.picture

    db.add(
        AuthIdentity(
            user_id=user.id,
            provider=AuthProvider.google,
            provider_subject=profile.subject,
            provider_email=email,
            last_used_at=now,
        )
    )
    await db.flush()
    return user
