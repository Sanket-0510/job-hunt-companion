import enum
import uuid
from collections.abc import AsyncIterator

from sqlalchemy import ForeignKey, MetaData, text
from sqlalchemy.dialects.postgresql import ENUM, TIMESTAMP, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import get_settings

DB_SCHEMA = "app"

# Fixed constraint names so Alembic autogenerate produces stable migrations.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(schema=DB_SCHEMA, naming_convention=NAMING_CONVENTION)


# Column helpers shared by every module's models.
TZ = TIMESTAMP(timezone=True)


def pg_enum(enum_cls: type[enum.Enum], name: str) -> ENUM:
    # Types are created by migrations, never by the ORM.
    return ENUM(
        enum_cls,
        name=name,
        schema=DB_SCHEMA,
        create_type=False,
        values_callable=lambda e: [m.value for m in e],
    )


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


def user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{DB_SCHEMA}.users.id", ondelete="CASCADE"), nullable=False
    )


def sqlalchemy_url(url: str) -> str:
    # Accept plain postgresql:// URLs from Supabase and pin the psycopg 3 driver (sync and async).
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


settings = get_settings()

engine = create_async_engine(
    sqlalchemy_url(settings.database_url),
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
