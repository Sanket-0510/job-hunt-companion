# One image for the API and both workers; only the start command differs:
#   API (default):     uvicorn app.main:app ...
#   quick worker:      python -m app.worker resumes reminders
#   suggestions:       python -m app.worker suggestions
FROM python:3.13-slim

# uv installs the locked dependencies fast and reproducibly.
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first, so code changes don't reinstall them (Docker layer cache).
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Don't run as root.
RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 8000

# Platforms that assign a port (Render, Fly, Cloud Run) set $PORT; default to 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
