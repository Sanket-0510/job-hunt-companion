from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.jobs.router import router as jobs_router
from app.modules.profiles.router import router as profile_router
from app.modules.resumes.router import router as resumes_router
from app.modules.suggestions.router import router as suggestions_router
from app.tasks import task_app


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # The API only defers tasks; the worker process runs them.
    async with task_app.open_async():
        yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Job Hunt Companion API",
        version="0.1.0",
        # Hide interactive docs outside local development.
        docs_url="/docs" if settings.is_local else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # Credentials allowed because auth uses an HTTP-only session cookie.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Short-lived signed cookie that only holds Google OAuth state between redirect and callback.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret.get_secret_value(),
        session_cookie="jc_oauth",
        max_age=600,
        same_site="lax",
        https_only=not settings.is_local,
    )
    register_error_handlers(app)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(profile_router)
    app.include_router(jobs_router)
    app.include_router(resumes_router)
    app.include_router(suggestions_router)

    return app


app = create_app()
