import httpx

from app.integrations.notifications.base import EmailMessage

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


class BrevoEmailSender:
    """Transactional email through Brevo's single verified sender (pilot, no domain yet)."""

    def __init__(self, api_key: str, from_address: str, from_name: str):
        self._api_key = api_key
        self._sender = {"email": from_address, "name": from_name}

    async def send(self, message: EmailMessage) -> None:
        payload = {
            "sender": self._sender,
            "to": [{"email": message.to}],
            "subject": message.subject,
            "textContent": message.text,
        }
        if message.html:
            payload["htmlContent"] = message.html
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                BREVO_SEND_URL, json=payload, headers={"api-key": self._api_key}
            )
            response.raise_for_status()
