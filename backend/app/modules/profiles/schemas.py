import re
import uuid
from datetime import datetime, time
from decimal import Decimal
from functools import lru_cache
from typing import Annotated
from zoneinfo import available_timezones

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    StringConstraints,
    field_validator,
)

from app.modules.profiles.models import JobSort, ReminderChannel

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]

E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")


@lru_cache
def _timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def _dedupe(values: list[str]) -> list[str]:
    # Keep the user's order, drop case-insensitive repeats.
    seen: set[str] = set()
    out = []
    for v in values:
        if v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return out


TagList = Annotated[list[Tag], Field(max_length=50), AfterValidator(_dedupe)]


class PastCompany(BaseModel):
    company: ShortText
    title: ShortText | None = None
    start: ShortText | None = None  # free text from the resume, e.g. "Jan 2022"
    end: ShortText | None = None


class Education(BaseModel):
    institution: ShortText
    degree: ShortText | None = None
    year: ShortText | None = None


class ProfileFields(BaseModel):
    """Editable fields. Every field is optional so PATCH can send just what changed."""

    full_name: ShortText | None = None
    target_role: ShortText | None = None
    years_experience: Decimal | None = Field(default=None, ge=0, le=50, decimal_places=1)
    preferred_cities: TagList | None = None
    skills: TagList | None = None
    past_companies: list[PastCompany] | None = Field(default=None, max_length=30)
    education: list[Education] | None = Field(default=None, max_length=20)
    linkedin_url: HttpUrl | None = None
    whatsapp_number: str | None = None
    resume_link: HttpUrl | None = None
    direct_email: EmailStr | None = None
    referral_email: EmailStr | None = None
    highlights: LongText | None = None
    referral_template: LongText | None = None
    follow_up_template: LongText | None = None
    default_follow_up_days: int | None = Field(default=None, ge=1, le=60)
    reminder_channel: ReminderChannel | None = None
    reminder_time: time | None = None
    timezone: str | None = None
    job_sort: JobSort | None = None

    @field_validator("whatsapp_number")
    @classmethod
    def _e164(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = re.sub(r"[\s\-()]", "", v)
        if not E164.match(v):
            raise ValueError("Use international format, e.g. +919876543210.")
        return v

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        if v is not None and v not in _timezones():
            raise ValueError("Unknown timezone. Use an IANA name such as Asia/Kolkata.")
        return v

    @field_validator("reminder_channel")
    @classmethod
    def _no_whatsapp_yet(cls, v: ReminderChannel | None) -> ReminderChannel | None:
        if v == ReminderChannel.whatsapp:
            raise ValueError("WhatsApp reminders are not available yet.")
        return v


class ProfileUpdate(ProfileFields):
    model_config = ConfigDict(extra="forbid")


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str | None
    target_role: str | None
    years_experience: Decimal | None
    preferred_cities: list[str]
    skills: list[str]
    past_companies: list[PastCompany]
    education: list[Education]
    linkedin_url: str | None
    whatsapp_number: str | None
    active_resume_id: uuid.UUID | None
    resume_link: str | None
    direct_email: str | None
    referral_email: str | None
    highlights: str | None
    referral_template: str | None
    follow_up_template: str | None
    default_follow_up_days: int
    reminder_channel: ReminderChannel
    reminder_time: time
    timezone: str
    job_sort: JobSort
    onboarded_at: datetime | None
    updated_at: datetime
