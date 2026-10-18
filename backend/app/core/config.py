from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["local", "staging", "production"] = "local"

    # Postgres: the Supabase session pooler URL. Write # in the password as %23.
    database_url: str
    # Optional. Leave it out to use database_url for the worker and Alembic too: Supabase's
    # direct host is IPv6-only, and the session pooler (port 5432) supports LISTEN/NOTIFY.
    database_direct_url: str = ""

    # Connection budget per process. Supabase's session pooler allows 15 clients in total on
    # the smaller plans, shared by the API and every worker, so keep each pool small.
    db_pool_size: int = 2
    db_max_overflow: int = 2
    task_pool_min: int = 1
    task_pool_max: int = 3

    # Supabase object storage (resume PDFs)
    supabase_url: str = ""
    supabase_service_key: SecretStr = SecretStr("")
    resume_bucket: str = "resumes"
    resume_max_bytes: int = 10 * 1024 * 1024

    # LLM for resume parsing. Groq exposes an OpenAI-compatible API.
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Background worker (Procrastinate)
    worker_concurrency: int = 5

    # Email via Brevo, single sender for the pilot
    brevo_api_key: SecretStr = SecretStr("")
    email_from_address: str = ""
    email_from_name: str = "Job Hunt Companion"

    # Auth
    session_secret: SecretStr
    session_ttl_days: int = 30
    session_cookie_name: str = "jc_session"
    # "none" when the frontend and API live on different sites (cookie then needs HTTPS).
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    session_cookie_domain: str | None = None
    password_reset_ttl_minutes: int = 60
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")

    frontend_origin: str = "http://localhost:3000"

    # Comma-separated emails allowed to open the admin analytics page. Empty = nobody.
    admin_emails: str = ""

    @model_validator(mode="after")
    def _direct_defaults_to_pooler(self) -> "Settings":
        if not self.database_direct_url.strip():
            self.database_direct_url = self.database_url
        return self

    @property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.admin_emails.split(",") if e.strip())

    @property
    def is_local(self) -> bool:
        return self.env == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
