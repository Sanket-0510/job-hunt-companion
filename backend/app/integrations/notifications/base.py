import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class LogEmailSender:
    """Local fallback when no provider key is set: prints the email instead of sending it."""

    async def send(self, message: EmailMessage) -> None:
        logger.warning("EMAIL to=%s subject=%r\n%s", message.to, message.subject, message.text)


@lru_cache
def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.brevo_api_key.get_secret_value():
        from app.integrations.notifications.brevo import BrevoEmailSender

        return BrevoEmailSender(
            api_key=settings.brevo_api_key.get_secret_value(),
            from_address=settings.email_from_address,
            from_name=settings.email_from_name,
        )
    return LogEmailSender()
