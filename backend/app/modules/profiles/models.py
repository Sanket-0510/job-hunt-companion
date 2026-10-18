import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    SmallInteger,
    Text,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import DB_SCHEMA, TZ, Base, pg_enum


class ReminderChannel(enum.StrEnum):
    email = "email"
    none = "none"
    whatsapp = "whatsapp"


class JobSort(enum.StrEnum):
    priority = "priority"
    follow_up_date = "follow_up_date"
    newest_found = "newest_found"
    company_az = "company_az"


class Profile(Base):
    """One row per user, created empty with the user. onboarded_at NULL means onboarding."""

    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("years_experience BETWEEN 0 AND 50", name="years_experience_range"),
        CheckConstraint(r"whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'", name="whatsapp_e164"),
        CheckConstraint("default_follow_up_days BETWEEN 1 AND 60", name="follow_up_days_range"),
        CheckConstraint("jsonb_typeof(past_companies) = 'array'", name="past_companies_array"),
        CheckConstraint("jsonb_typeof(education) = 'array'", name="education_array"),
        # Drop when WhatsApp reminders ship.
        CheckConstraint("reminder_channel <> 'whatsapp'", name="whatsapp_not_yet"),
        # Composite FK: a profile can only point at one of its own resumes. Postgres 15+
        # "SET NULL (col)" clears only active_resume_id, never user_id.
        ForeignKeyConstraint(
            ["active_resume_id", "user_id"],
            [f"{DB_SCHEMA}.resumes.id", f"{DB_SCHEMA}.resumes.user_id"],
            name="fk_profiles_active_resume",
            ondelete="SET NULL (active_resume_id)",
        ),
        # Scheduler: users whose morning email time has arrived.
        Index(
            "ix_profiles_reminder_time_email",
            "reminder_time",
            postgresql_where=text("reminder_channel = 'email'"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{DB_SCHEMA}.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # About you
    full_name: Mapped[str | None] = mapped_column(Text)
    target_role: Mapped[str | None] = mapped_column(Text)
    years_experience: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    preferred_cities: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )  # first element is "the" preferred city
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    past_companies: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    education: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    whatsapp_number: Mapped[str | None] = mapped_column(Text)
    # Resume
    active_resume_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    resume_link: Mapped[str | None] = mapped_column(Text)  # {resume link} in messages
    # How you apply
    direct_email: Mapped[str | None] = mapped_column(CITEXT)
    referral_email: Mapped[str | None] = mapped_column(CITEXT)
    # Messages
    highlights: Mapped[str | None] = mapped_column(Text)
    referral_template: Mapped[str | None] = mapped_column(Text)  # NULL = built-in default
    follow_up_template: Mapped[str | None] = mapped_column(Text)  # NULL = built-in default
    default_follow_up_days: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="5"
    )
    # Reminders
    reminder_channel: Mapped[ReminderChannel] = mapped_column(
        pg_enum(ReminderChannel, "reminder_channel"), nullable=False, server_default="email"
    )
    reminder_time: Mapped[time] = mapped_column(Time, nullable=False, server_default="08:00")
    timezone: Mapped[str] = mapped_column(Text, nullable=False, server_default="Asia/Kolkata")
    last_digest_sent_on: Mapped[date | None] = mapped_column(Date)  # scheduler dedupe
    # UI preference
    job_sort: Mapped[JobSort] = mapped_column(
        pg_enum(JobSort, "job_sort"), nullable=False, server_default="priority"
    )
    onboarded_at: Mapped[datetime | None] = mapped_column(TZ)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False, server_default=func.now())
