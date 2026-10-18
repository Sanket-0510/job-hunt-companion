import os

# Settings are read at import time; give tests harmless defaults before importing the app.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("DATABASE_DIRECT_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("SESSION_SECRET", "test-only")
# Env vars beat backend/.env, so tests never call real providers.
for key in ("GOOGLE_CLIENT_ID", "BREVO_API_KEY", "GROQ_API_KEY"):
    os.environ[key] = ""
