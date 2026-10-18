from functools import lru_cache

from authlib.integrations.starlette_client import OAuth

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable

GOOGLE_METADATA_URL = "https://accounts.google.com/.well-known/openid-configuration"


@lru_cache
def _oauth() -> OAuth:
    settings = get_settings()
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret.get_secret_value(),
        server_metadata_url=GOOGLE_METADATA_URL,
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth


def google_client():
    if not get_settings().google_client_id:
        raise ServiceUnavailable("Google login is not configured.", code="google_not_configured")
    return _oauth().google
