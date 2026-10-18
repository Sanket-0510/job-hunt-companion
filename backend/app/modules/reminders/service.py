"""Morning digest: which users are due an email now, and what it says."""

import uuid
from datetime import date
from html import escape

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.notifications.base import EmailMessage
from app.modules.auth.models import User
from app.modules.jobs.models import Job
from app.modules.jobs.service import due_clause, due_item
from app.modules.profiles.models import Profile

# One statement claims every user whose local send time has arrived and marks them sent for
# their local today, so overlapping scheduler runs can never enqueue the same user twice.
# The 3-hour window stops a late reminder-time change from sending a surprise evening email.
CLAIM_DUE_DIGESTS = text("""
WITH local AS (
  SELECT p.user_id,
         now() AT TIME ZONE p.timezone                           AS local_now,
         (now() AT TIME ZONE p.timezone)::date + p.reminder_time AS send_at
  FROM app.profiles p
  WHERE p.reminder_channel = 'email'
), due AS (
  SELECT l.user_id, l.send_at::date AS local_today
  FROM local l JOIN app.profiles p USING (user_id)
  WHERE l.local_now >= l.send_at
    AND l.local_now <  l.send_at + interval '3 hours'
    AND (p.last_digest_sent_on IS NULL OR p.last_digest_sent_on < l.send_at::date)
  FOR UPDATE OF p SKIP LOCKED
)
UPDATE app.profiles p
SET last_digest_sent_on = due.local_today
FROM due
WHERE p.user_id = due.user_id
RETURNING p.user_id, due.local_today
""")


async def claim_due_digests(db: AsyncSession) -> list[tuple[uuid.UUID, date]]:
    rows = (await db.execute(CLAIM_DUE_DIGESTS)).all()
    await db.commit()
    return [(r.user_id, r.local_today) for r in rows]


def _waiting_line(item) -> str:
    track = "Referral asked" if item.waiting_track == "referral" else "Applied"
    if item.days_waiting is None:
        return "Follow-up due"
    if item.days_waiting == 0:
        return f"{track} today"
    unit = "day" if item.days_waiting == 1 else "days"
    return f"{track} {item.days_waiting} {unit} ago"


async def build_digest(
    db: AsyncSession, user_id: uuid.UUID, local_today: date
) -> EmailMessage | None:
    """The digest for one user's local date, or None when nothing is due (no email then)."""
    user = await db.get(User, user_id)
    profile = await db.get(Profile, user_id)
    if user is None or profile is None:
        return None
    jobs = (
        await db.scalars(
            select(Job)
            .where(Job.user_id == user_id, due_clause(local_today))
            .order_by(Job.follow_up_date, Job.priority)
        )
    ).all()
    if not jobs:
        return None

    items = [due_item(j, profile, local_today) for j in jobs]
    origin = get_settings().frontend_origin.rstrip("/")
    count = len(items)
    subject = f"{count} follow-up{'s' if count != 1 else ''} due today"
    greeting = f"Hi {profile.full_name.split()[0]}," if profile.full_name else "Hi,"

    lines = [f"- {i.job.company} · {i.job.role} — {_waiting_line(i)}" for i in items]
    text_body = "\n".join(
        [greeting, "", f"Here's what to follow up on today ({local_today:%a %d %b}):", "", *lines,
         "", f"Open your dashboard: {origin}/", "",
         f"Change reminder time or turn these emails off: {origin}/settings"]
    )  # fmt: skip

    rows = "".join(
        f"<li><strong>{escape(i.job.company)}</strong> · {escape(i.job.role)}"
        f"<br><span style='color:#5b6875'>{escape(_waiting_line(i))}</span></li>"
        for i in items
    )
    html_body = (
        "<div style='font-family:Arial,sans-serif;color:#17212b;max-width:520px'>"
        f"<p>{escape(greeting)}</p>"
        f"<p>Here's what to follow up on today ({local_today:%a %d %b}):</p>"
        f"<ul style='padding-left:18px;line-height:1.5'>{rows}</ul>"
        f"<p><a href='{origin}/' style='background:#1f6f78;color:#fff;padding:10px 16px;"
        "border-radius:6px;text-decoration:none'>Open dashboard</a></p>"
        f"<p style='font-size:12px;color:#5b6875'>Change reminder time or turn these emails "
        f"off in <a href='{origin}/settings'>Settings</a>.</p></div>"
    )
    return EmailMessage(to=user.email, subject=subject, text=text_body, html=html_body)
