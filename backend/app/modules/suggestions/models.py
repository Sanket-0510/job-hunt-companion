import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import DB_SCHEMA, TZ, Base, user_fk, uuid_pk

PROVIDERS = ("greenhouse", "lever", "ashby", "smartrecruiters", "workday")
SUGGESTION_STATUSES = ("new", "added", "dismissed")


class CompanyBoard(Base):
    """A company's public job board we read openings from (no scraping, official APIs only)."""

    __tablename__ = "company_boards"
    __table_args__ = (
        UniqueConstraint("provider", "slug"),
        CheckConstraint(f"provider IN {PROVIDERS}", name="provider_known"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)  # board token in the provider's URL
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    last_fetched_at: Mapped[datetime | None] = mapped_column(TZ)
    last_error: Mapped[str | None] = mapped_column(Text)


class Opening(Base):
    """A live posting from a board. Rows not seen in the latest fetch are deleted."""

    __tablename__ = "openings"
    __table_args__ = (UniqueConstraint("board_id", "external_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DB_SCHEMA}.company_boards.id", ondelete="CASCADE"),
        nullable=False,
    )
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(TZ)
    first_seen_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())


class Suggestion(Base):
    """One opening picked for one user, with the model's one-line reason."""

    __tablename__ = "suggestions"
    __table_args__ = (
        UniqueConstraint("user_id", "opening_id"),
        CheckConstraint(f"status IN {SUGGESTION_STATUSES}", name="status_known"),
        Index("ix_suggestions_user_id_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = user_fk()
    opening_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DB_SCHEMA}.openings.id", ondelete="CASCADE"),
        nullable=False,
    )
    rank: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="new")
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
