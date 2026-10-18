from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool, text

# Import every module's models so their tables register on Base.metadata.
import app.modules.auth.models  # noqa: F401
import app.modules.jobs.models  # noqa: F401
import app.modules.profiles.models  # noqa: F401
import app.modules.reminders.models  # noqa: F401
import app.modules.resumes.models  # noqa: F401
import app.modules.suggestions.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import DB_SCHEMA, Base, sqlalchemy_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(name, type_, parent_names) -> bool:
    # Only manage our schema; Procrastinate and Supabase own everything else.
    if type_ == "schema":
        return name == DB_SCHEMA
    return True


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        include_schemas=True,
        include_name=include_name,
        version_table_schema=DB_SCHEMA,
        compare_type=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    _configure(
        url=sqlalchemy_url(get_settings().database_direct_url),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Direct connection, not the pooler: migrations need a real session for DDL.
    engine = create_engine(
        sqlalchemy_url(get_settings().database_direct_url), poolclass=pool.NullPool
    )
    with engine.connect() as connection:
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA}"))
        connection.commit()
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
