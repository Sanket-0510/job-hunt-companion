import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.profiles.schemas import Education, PastCompany
from app.modules.resumes.models import ParseStatus

MAX_TEXT = 200


def _clip(value: Any) -> Any:
    """LLM output is untrusted: trim strings to profile limits instead of failing the parse."""
    if isinstance(value, str):
        value = value.strip()[:MAX_TEXT]
        return value or None
    if isinstance(value, dict):
        return {k: _clip(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clip(v) for v in value]
    return value


class ParsedResume(BaseModel):
    """What the parser returns; the frontend pre-fills the profile form from it."""

    full_name: str | None = None
    skills: list[str] = Field(default_factory=list)
    past_companies: list[PastCompany] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)

    @classmethod
    def from_llm(cls, raw: dict) -> "ParsedResume":
        data = _clip(raw)
        data["skills"] = [s for s in (data.get("skills") or []) if isinstance(s, str)][:50]
        data["past_companies"] = [
            c
            for c in (data.get("past_companies") or [])
            if isinstance(c, dict) and c.get("company")
        ][:30]
        data["education"] = [
            e for e in (data.get("education") or []) if isinstance(e, dict) and e.get("institution")
        ][:20]
        return cls.model_validate(data)

    @field_validator("skills")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        seen, out = set(), []
        for s in v:
            if s.lower() not in seen:
                seen.add(s.lower())
                out.append(s)
        return out


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    size_bytes: int
    parse_status: ParseStatus
    parsed_data: ParsedResume | None
    # Short code when parsing failed: no_text, unreadable_pdf, parser_unavailable, parser_failed
    parse_error: str | None
    created_at: datetime
    parsed_at: datetime | None
