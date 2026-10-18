import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints

from app.modules.jobs.messages import JobMessages, LinkedInLinks
from app.modules.jobs.models import DirectStatus, JobPriority, JobStage, ReferralStatus
from app.modules.profiles.models import JobSort

Required = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]


class JobFields(BaseModel):
    """Fields shared by create and update. Card autosave sends one field at a time."""

    model_config = ConfigDict(extra="forbid")

    location: ShortText | None = None
    experience_asked: ShortText | None = None
    apply_url: HttpUrl | None = None
    source: ShortText | None = None
    priority: JobPriority | None = None
    date_found: date | None = None
    notes: Notes | None = None
    direct_status: DirectStatus | None = None
    applied_on: date | None = None
    referral_status: ReferralStatus | None = None
    referral_contact: ShortText | None = None
    asked_on: date | None = None
    company_linkedin_url: HttpUrl | None = None
    recruiter_name: ShortText | None = None
    recruiter_linkedin_url: HttpUrl | None = None
    follow_up_date: date | None = None
    emails_reversed: bool | None = None


class JobCreate(JobFields):
    company: Required
    role: Required


class JobUpdate(JobFields):
    company: Required | None = None
    role: Required | None = None
    # Optimistic concurrency: the updated_at the client last saw. Stale edits get 409.
    expected_updated_at: datetime | None = None


class TrackEmails(BaseModel):
    direct: str | None
    referral: str | None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company: str
    role: str
    location: str | None
    experience_asked: str | None
    apply_url: str | None
    source: str | None
    priority: JobPriority
    date_found: date
    notes: str | None
    direct_status: DirectStatus
    applied_on: date | None
    referral_status: ReferralStatus
    referral_contact: str | None
    asked_on: date | None
    company_linkedin_url: str | None
    recruiter_name: str | None
    recruiter_linkedin_url: str | None
    follow_up_date: date | None
    snoozed_at: datetime | None
    emails_reversed: bool
    stage: JobStage
    created_at: datetime
    updated_at: datetime
    # Computed per request from the profile and the user's local date.
    is_due: bool
    emails: TrackEmails
    messages: JobMessages
    linkedin: LinkedInLinks


class JobFilters(BaseModel):
    q: str | None = Field(default=None, max_length=100)
    direct_status: DirectStatus | None = None
    referral_status: ReferralStatus | None = None
    due: bool = False
    emails_reversed: bool = False
    preferred_city: bool = False
    sort: JobSort | None = None  # None = the user's remembered sort


class PipelineCounts(BaseModel):
    all_jobs: int
    direct: dict[DirectStatus, int]
    referral: dict[ReferralStatus, int]
    follow_up_due: int
    emails_reversed: int


class JobList(BaseModel):
    jobs: list[JobOut]
    counts: PipelineCounts
    sort: JobSort
    user_today: date


class DueItem(BaseModel):
    job: JobOut
    waiting_track: str  # "referral" or "direct"
    waiting_since: date | None  # asked_on or applied_on
    days_waiting: int | None


class Dashboard(BaseModel):
    user_today: date
    due_count: int
    active_count: int  # jobs not closed
    due_today: list[DueItem]
    counts: PipelineCounts
    recently_added: list[JobOut]


class TemplatesOut(BaseModel):
    """Settings > Message templates. A null custom template means the default is in use."""

    referral_default: str
    follow_up_default: str
    referral_custom: str | None
    follow_up_custom: str | None
    fields: dict[str, str]
