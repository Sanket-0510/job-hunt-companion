import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Index, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TZ, Base, pg_enum, user_fk, uuid_pk


class ParseStatus(enum.StrEnum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class Resume(Base):
    __tablename__ = "resumes"
    __table_args__ = (
        CheckConstraint("size_bytes > 0 AND size_bytes <= 10485760", name="size_range"),
        CheckConstraint("parse_status <> 'done' OR parsed_data IS NOT NULL", name="data_if_done"),
        CheckConstraint(
            "parse_status <> 'failed' OR parse_error IS NOT NULL", name="err_if_failed"
        ),
        # Target of profiles' composite FK, so a profile can only point at its own resume.
        UniqueConstraint("id", "user_id", name="uq_resumes_id_user_id"),
        Index("ix_resumes_user_id_created_at", "user_id", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = user_fk()
    # Key inside the bucket: "{user_id}/{resume_id}.pdf"
    storage_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="application/pdf"
    )
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    parse_status: Mapped[ParseStatus] = mapped_column(
        pg_enum(ParseStatus, "parse_status"), nullable=False, server_default="pending"
    )
    # {full_name, skills[], past_companies[], education[]}
    parsed_data: Mapped[dict | None] = mapped_column(JSONB)
    parse_error: Mapped[str | None] = mapped_column(Text)
    parse_started_at: Mapped[datetime | None] = mapped_column(TZ)
    parsed_at: Mapped[datetime | None] = mapped_column(TZ)  # finished, done or failed
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
