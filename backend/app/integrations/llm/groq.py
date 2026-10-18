import json

import httpx

from app.integrations.llm.base import LLMError


class GroqClient:
    """Groq through its OpenAI-compatible chat completions endpoint, in JSON mode."""

    def __init__(self, api_key: str, model: str, base_url: str, timeout: float = 45):
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._model = model
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._timeout = timeout

    async def complete_json(self, system: str, user: str) -> dict:
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(self._url, json=payload, headers=self._headers)
        except httpx.HTTPError as exc:
            raise LLMError(f"Groq request failed: {type(exc).__name__}") from exc
        if response.status_code != 200:
            raise LLMError(f"Groq returned HTTP {response.status_code}")
        try:
            content = response.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
        except (KeyError, IndexError, ValueError) as exc:
            raise LLMError("Groq reply was not valid JSON") from exc
        if not isinstance(data, dict):
            raise LLMError("Groq reply was not a JSON object")
        return data
