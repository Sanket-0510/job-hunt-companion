import enum
import uuid
from datetime import datetime
from ipaddress import IPv4Address, IPv6Address

from sqlalchemy import CheckConstraint, Index, LargeBinary, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import CITEXT, INET
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TZ, Base, pg_enum, user_fk, uuid_pk


class AuthProvider(enum.StrEnum):
    google = "google"


class AuthTokenPurpose(enum.StrEnum):
    password_reset = "password_reset"
    email_verify = "email_verify"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("position('@' IN email) > 1", name="email_shape"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(TZ)
    password_hash: Mapped[str | None] = mapped_column(Text)  # NULL for Google-only accounts
    avatar_url: Mapped[str | None] = mapped_column(Text)
    last_login_at: Mapped[datetime | None] = mapped_column(TZ)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None


class AuthIdentity(Base):
    __tablename__ = "auth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_subject"),
        UniqueConstraint("user_id", "provider"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = user_fk()
    provider: Mapped[AuthProvider] = mapped_column(
        pg_enum(AuthProvider, "auth_provider"), nullable=False
    )
    provider_subject: Mapped[str] = mapped_column(Text, nullable=False)  # Google "sub"
    provider_email: Mapped[str | None] = mapped_column(CITEXT)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(TZ)


class UserSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_user_id", "user_id"),
        Index("ix_sessions_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = user_fk()
    # sha256 of the cookie value; the raw token is never stored.
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TZ)
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[IPv4Address | IPv6Address | None] = mapped_column(INET)


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    __table_args__ = (Index("ix_auth_tokens_user_id_purpose", "user_id", "purpose"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = user_fk()
    purpose: Mapped[AuthTokenPurpose] = mapped_column(
        pg_enum(AuthTokenPurpose, "auth_token_purpose"), nullable=False
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(TZ)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
