from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings


class LLMError(Exception):
    """The provider failed or returned something unusable."""


class LLMClient(Protocol):
    async def complete_json(self, system: str, user: str) -> dict:
        """Return the model's reply parsed as a JSON object."""
        ...


@lru_cache
def get_llm() -> LLMClient:
    settings = get_settings()
    if not settings.groq_api_key.get_secret_value():
        raise LLMError("No LLM provider is configured (set GROQ_API_KEY).")
    from app.integrations.llm.groq import GroqClient

    return GroqClient(
        api_key=settings.groq_api_key.get_secret_value(),
        model=settings.groq_model,
        base_url=settings.groq_base_url,
    )
