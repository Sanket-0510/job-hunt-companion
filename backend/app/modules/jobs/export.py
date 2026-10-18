import csv
import io
from collections.abc import Iterable, Iterator
from datetime import date

from app.modules.jobs.models import Job
from app.modules.jobs.service import track_emails
from app.modules.profiles.models import Profile

COLUMNS = [
    "company", "role", "location", "experience_asked", "apply_url", "source", "priority",
    "date_found", "stage", "direct_status", "applied_on", "direct_email", "referral_status",
    "referral_contact", "asked_on", "referral_email", "follow_up_date", "due", "snoozed_at",
    "emails_reversed", "company_linkedin_url", "recruiter_name", "recruiter_linkedin_url",
    "notes", "created_at", "updated_at",
]  # fmt: skip


def _safe(value) -> str:
    """Stringify and neutralise spreadsheet formula injection (=, +, -, @ at the start)."""
    if value is None:
        return ""
    text = value.value if hasattr(value, "value") else str(value)
    if text and text[0] in "=+-@\t\r":
        return "'" + text
    return text


def _row(job: Job, profile: Profile, today: date) -> list[str]:
    emails = track_emails(job, profile)
    extra = {
        "direct_email": emails.direct,
        "referral_email": emails.referral,
        "due": "yes" if job.is_due(today) else "no",
        "emails_reversed": "yes" if job.emails_reversed else "no",
    }
    return [_safe(extra[c] if c in extra else getattr(job, c)) for c in COLUMNS]


def csv_lines(jobs: Iterable[Job], profile: Profile, today: date) -> Iterator[str]:
    buf = io.StringIO()
    writer = csv.writer(buf)
    # BOM so Excel opens UTF-8 (₹, non-Latin names) correctly.
    buf.write("﻿")
    writer.writerow(COLUMNS)
    for job in jobs:
        writer.writerow(_row(job, profile, today))
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate()
    yield buf.getvalue()
