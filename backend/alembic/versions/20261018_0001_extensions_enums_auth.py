"""extensions, enums, updated_at trigger, auth tables

Revision ID: 0001
Revises:
Create Date: 2026-10-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

S = "app"

# Every enum in the schema doc is created here so later migrations only add tables.
ENUMS: dict[str, tuple[str, ...]] = {
    "auth_provider": ("google",),
    "auth_token_purpose": ("password_reset", "email_verify"),
    "parse_status": ("pending", "running", "done", "failed"),
    "reminder_channel": ("email", "none", "whatsapp"),
    "job_sort": ("priority", "follow_up_date", "newest_found", "company_az"),
    "job_priority": ("high", "medium", "low"),
    "direct_status": ("not_applied", "applied", "interviewing", "offer", "rejected"),
    "referral_status": (
        "not_asked",
        "asked",
        "referred_internally",
        "referral_link_received",
        "applied_via_referral",
        "interviewing",
        "offer",
        "rejected",
        "no_response",
    ),
    "job_stage": ("to_do", "referral", "applied", "interview", "offer", "closed"),
}


def enum(name: str) -> pg.ENUM:
    return pg.ENUM(name=name, schema=S, create_type=False)


def uuid_pk() -> sa.Column:
    return sa.Column(
        "id", pg.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def user_fk() -> sa.Column:
    return sa.Column(
        "user_id",
        pg.UUID(as_uuid=True),
        sa.ForeignKey(f"{S}.users.id", ondelete="CASCADE"),
        nullable=False,
    )


def ts(name: str, *, nullable: bool = True, default: bool = False) -> sa.Column:
    return sa.Column(
        name,
        sa.TIMESTAMP(timezone=True),
        nullable=nullable,
        server_default=sa.func.now() if default else None,
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    for name, values in ENUMS.items():
        labels = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {S}.{name} AS ENUM ({labels})")

    op.execute(
        f"""
        CREATE FUNCTION {S}.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          NEW.updated_at := now();
          RETURN NEW;
        END $$
        """
    )

    op.create_table(
        "users",
        uuid_pk(),
        sa.Column("email", pg.CITEXT(), nullable=False, unique=True),
        ts("email_verified_at"),
        sa.Column("password_hash", sa.Text()),
        sa.Column("avatar_url", sa.Text()),
        ts("last_login_at"),
        ts("created_at", nullable=False, default=True),
        ts("updated_at", nullable=False, default=True),
        sa.CheckConstraint("position('@' IN email) > 1", name="email_shape"),
        schema=S,
    )
    op.execute(
        f"CREATE TRIGGER users_updated_at BEFORE UPDATE ON {S}.users "
        f"FOR EACH ROW EXECUTE FUNCTION {S}.set_updated_at()"
    )

    op.create_table(
        "auth_identities",
        uuid_pk(),
        user_fk(),
        sa.Column("provider", enum("auth_provider"), nullable=False),
        sa.Column("provider_subject", sa.Text(), nullable=False),
        sa.Column("provider_email", pg.CITEXT()),
        ts("created_at", nullable=False, default=True),
        ts("last_used_at"),
        sa.UniqueConstraint("provider", "provider_subject"),
        sa.UniqueConstraint("user_id", "provider"),
        schema=S,
    )

    op.create_table(
        "sessions",
        uuid_pk(),
        user_fk(),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False, unique=True),
        ts("created_at", nullable=False, default=True),
        ts("last_seen_at", nullable=False, default=True),
        ts("expires_at", nullable=False),
        ts("revoked_at"),
        sa.Column("user_agent", sa.Text()),
        sa.Column("ip", pg.INET()),
        schema=S,
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], schema=S)
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"], schema=S)

    op.create_table(
        "auth_tokens",
        uuid_pk(),
        user_fk(),
        sa.Column("purpose", enum("auth_token_purpose"), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False, unique=True),
        ts("expires_at", nullable=False),
        ts("used_at"),
        ts("created_at", nullable=False, default=True),
        schema=S,
    )
    op.create_index(
        "ix_auth_tokens_user_id_purpose", "auth_tokens", ["user_id", "purpose"], schema=S
    )


def downgrade() -> None:
    for table in ("auth_tokens", "sessions", "auth_identities", "users"):
        op.drop_table(table, schema=S)
    op.execute(f"DROP FUNCTION IF EXISTS {S}.set_updated_at()")
    for name in reversed(ENUMS):
        op.execute(f"DROP TYPE IF EXISTS {S}.{name}")
