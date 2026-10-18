import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, and_, func, nulls_last, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Conflict
from app.modules.jobs.messages import job_messages, linkedin_links
from app.modules.jobs.models import (
    REFERRAL_WAITING,
    DirectStatus,
    Job,
    JobStage,
    ReferralStatus,
)
from app.modules.jobs.schemas import (
    DueItem,
    JobCreate,
    JobFilters,
    JobOut,
    JobUpdate,
    PipelineCounts,
    TrackEmails,
)
from app.modules.profiles.models import JobSort, Profile

SNOOZE_DAYS = 3
RECENT_LIMIT = 5
_URL_FIELDS = {"apply_url", "company_linkedin_url", "recruiter_linkedin_url"}
_NOT_NULL = {"company", "role", "priority", "date_found", "direct_status", "referral_status",
             "emails_reversed"}  # fmt: skip


class JobNotFound(AppError):
    status_code = 404
    code = "job_not_found"


def user_today(profile: Profile) -> date:
    """The user's local calendar date; due logic and auto-filled dates depend on it."""
    return datetime.now(ZoneInfo(profile.timezone)).date()


# ---------------------------------------------------------------- output


def track_emails(job: Job, profile: Profile) -> TrackEmails:
    direct, referral = profile.direct_email, profile.referral_email
    if job.emails_reversed:
        direct, referral = referral, direct
    return TrackEmails(direct=direct, referral=referral)


def to_out(job: Job, profile: Profile, today: date) -> JobOut:
    return JobOut.model_validate(
        {
            **{c: getattr(job, c) for c in JobOut.model_fields if hasattr(job, c)},
            "is_due": job.is_due(today),
            "emails": track_emails(job, profile),
            "messages": job_messages(profile, job),
            "linkedin": linkedin_links(job),
        }
    )


# ---------------------------------------------------------------- writes


def _apply_changes(job: Job, changes: dict, today: date) -> None:
    for field, value in changes.items():
        if field in _URL_FIELDS and value is not None:
            value = str(value)
        setattr(job, field, value)
    # Status-change rules from the spec; they need the user's local date.
    if "direct_status" in changes and job.direct_status == DirectStatus.applied:
        job.applied_on = job.applied_on or today
    if "referral_status" in changes and job.referral_status == ReferralStatus.asked:
        job.asked_on = job.asked_on or today


async def create_job(db: AsyncSession, user_id: uuid.UUID, body: JobCreate, today: date) -> Job:
    job = Job(user_id=user_id, date_found=today)
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    _apply_changes(job, changes, today)
    db.add(job)
    await db.flush()
    await db.refresh(job)  # load stage and timestamps from Postgres
    return job


async def get_job(db: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID, *, lock=False) -> Job:
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    if lock:
        stmt = stmt.with_for_update()
    job = await db.scalar(stmt)
    if job is None:
        raise JobNotFound("This job no longer exists.")
    return job


async def update_job(
    db: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID, body: JobUpdate, today: date
) -> Job:
    job = await get_job(db, user_id, job_id, lock=True)
    changes = body.model_dump(exclude_unset=True)
    expected = changes.pop("expected_updated_at", None)
    if expected is not None and expected != job.updated_at:
        raise Conflict(
            "This job was changed on another device. Reload to see the latest.",
            code="job_changed",
        )
    for field in _NOT_NULL & changes.keys():
        if changes[field] is None:
            raise AppError(f"{field} cannot be empty.", code="required_field", status_code=422)
    _apply_changes(job, changes, today)
    await db.flush()
    await db.refresh(job)
    return job


async def delete_job(db: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID) -> None:
    await db.delete(await get_job(db, user_id, job_id))


async def snooze_job(db: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID, today: date) -> Job:
    job = await get_job(db, user_id, job_id, lock=True)
    job.follow_up_date = today + timedelta(days=SNOOZE_DAYS)
    job.snoozed_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(job)
    return job


# ---------------------------------------------------------------- queries


def due_clause(today: date):
    return and_(
        Job.follow_up_date.is_not(None),
        Job.follow_up_date <= today,
        Job.stage.not_in([JobStage.offer, JobStage.closed]),
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _base_query(user_id: uuid.UUID, filters: JobFilters, profile: Profile) -> Select:
    """Search and city filters. Pipeline counts use this; the list adds status filters."""
    stmt = select(Job).where(Job.user_id == user_id)
    if filters.q and filters.q.strip():
        pattern = f"%{_escape_like(filters.q.strip().lower())}%"
        stmt = stmt.where(Job.search_text.like(pattern, escape="\\"))
    if filters.preferred_city and profile.preferred_cities:
        city = f"%{_escape_like(profile.preferred_cities[0])}%"
        stmt = stmt.where(Job.location.ilike(city, escape="\\"))
    return stmt


_SORTS = {
    JobSort.priority: lambda: [
        (Job.stage == JobStage.closed),  # closed jobs sink
        Job.priority,
        nulls_last(Job.follow_up_date),
        Job.created_at.desc(),
    ],
    JobSort.follow_up_date: lambda: [nulls_last(Job.follow_up_date), Job.priority],
    JobSort.newest_found: lambda: [Job.date_found.desc(), Job.created_at.desc()],
    JobSort.company_az: lambda: [func.lower(Job.company), func.lower(Job.role)],
}


def list_query(
    user_id: uuid.UUID, filters: JobFilters, profile: Profile, sort: JobSort, today: date
) -> Select:
    stmt = _base_query(user_id, filters, profile)
    if filters.direct_status:
        stmt = stmt.where(Job.direct_status == filters.direct_status)
    if filters.referral_status:
        stmt = stmt.where(Job.referral_status == filters.referral_status)
    if filters.due:
        stmt = stmt.where(due_clause(today))
    if filters.emails_reversed:
        stmt = stmt.where(Job.emails_reversed.is_(True))
    return stmt.order_by(*_SORTS[sort](), Job.id)


async def list_jobs(
    db: AsyncSession, user_id: uuid.UUID, filters: JobFilters, profile: Profile, today: date
) -> tuple[list[Job], JobSort]:
    sort = filters.sort or profile.job_sort
    if filters.sort and filters.sort != profile.job_sort:
        profile.job_sort = filters.sort  # remembered across devices
    jobs = (await db.scalars(list_query(user_id, filters, profile, sort, today))).all()
    return list(jobs), sort


async def pipeline_counts(
    db: AsyncSession,
    user_id: uuid.UUID,
    today: date,
    filters: JobFilters | None = None,
    profile: Profile | None = None,
) -> PipelineCounts:
    base = (
        _base_query(user_id, filters, profile).subquery()
        if filters and profile
        else select(Job).where(Job.user_id == user_id).subquery()
    )
    j = base.c

    def count_if(cond):
        return func.count().filter(cond)

    cols = [func.count().label("all_jobs")]
    cols += [count_if(j.direct_status == s).label(f"d_{s}") for s in DirectStatus]
    cols += [count_if(j.referral_status == s).label(f"r_{s}") for s in ReferralStatus]
    cols.append(
        count_if(
            and_(
                j.follow_up_date.is_not(None),
                j.follow_up_date <= today,
                j.stage.not_in([JobStage.offer, JobStage.closed]),
            )
        ).label("follow_up_due")
    )
    cols.append(count_if(j.emails_reversed.is_(True)).label("emails_reversed"))
    row = (await db.execute(select(*cols).select_from(base))).one()._mapping
    return PipelineCounts(
        all_jobs=row["all_jobs"],
        direct={s: row[f"d_{s}"] for s in DirectStatus},
        referral={s: row[f"r_{s}"] for s in ReferralStatus},
        follow_up_due=row["follow_up_due"],
        emails_reversed=row["emails_reversed"],
    )


def due_item(job: Job, profile: Profile, today: date) -> DueItem:
    if job.referral_status in REFERRAL_WAITING:
        track, since = "referral", job.asked_on
    else:
        track, since = "direct", job.applied_on
    return DueItem(
        job=to_out(job, profile, today),
        waiting_track=track,
        waiting_since=since,
        days_waiting=(today - since).days if since else None,
    )


async def dashboard(db: AsyncSession, user_id: uuid.UUID, profile: Profile, today: date) -> dict:
    due = (
        await db.scalars(
            select(Job)
            .where(Job.user_id == user_id, due_clause(today))
            .order_by(Job.follow_up_date, Job.priority)
        )
    ).all()
    recent = (
        await db.scalars(
            select(Job)
            .where(Job.user_id == user_id)
            .order_by(Job.created_at.desc())
            .limit(RECENT_LIMIT)
        )
    ).all()
    active = await db.scalar(
        select(func.count()).where(Job.user_id == user_id, Job.stage != JobStage.closed)
    )
    return {
        "user_today": today,
        "due_count": len(due),
        "active_count": active,
        "due_today": [due_item(j, profile, today) for j in due],
        "counts": await pipeline_counts(db, user_id, today),
        "recently_added": [to_out(j, profile, today) for j in recent],
    }
