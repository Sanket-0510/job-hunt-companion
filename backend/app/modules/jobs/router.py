import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import StreamingResponse

from app.modules.auth.dependencies import CurrentUser, DbSession
from app.modules.jobs import messages, service
from app.modules.jobs.export import csv_lines
from app.modules.jobs.schemas import (
    Dashboard,
    JobCreate,
    JobFilters,
    JobList,
    JobOut,
    JobUpdate,
    TemplatesOut,
)
from app.modules.profiles.service import get_profile

router = APIRouter(tags=["jobs"])

Filters = Annotated[JobFilters, Query()]


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(user: CurrentUser, db: DbSession) -> dict:
    profile = await get_profile(db, user.id)
    return await service.dashboard(db, user.id, profile, service.user_today(profile))


@router.get("/messages/templates", response_model=TemplatesOut)
async def message_templates(user: CurrentUser, db: DbSession) -> TemplatesOut:
    """Defaults and fill-in fields for Settings. Reset to default = PATCH /profile with null."""
    profile = await get_profile(db, user.id)
    return TemplatesOut(
        referral_default=messages.DEFAULT_REFERRAL,
        follow_up_default=messages.DEFAULT_FOLLOW_UP,
        referral_custom=profile.referral_template,
        follow_up_custom=profile.follow_up_template,
        fields=messages.FIELDS,
    )


@router.get("/jobs", response_model=JobList)
async def list_jobs(filters: Filters, user: CurrentUser, db: DbSession) -> JobList:
    profile = await get_profile(db, user.id)
    today = service.user_today(profile)
    jobs, sort = await service.list_jobs(db, user.id, filters, profile, today)
    counts = await service.pipeline_counts(db, user.id, today, filters, profile)
    await db.commit()  # persists a changed sort preference
    return JobList(
        jobs=[service.to_out(j, profile, today) for j in jobs],
        counts=counts,
        sort=sort,
        user_today=today,
    )


@router.get("/jobs/export.csv")
async def export_csv(filters: Filters, user: CurrentUser, db: DbSession) -> StreamingResponse:
    """Exports the jobs currently shown, with the same filters and sort as the list."""
    profile = await get_profile(db, user.id)
    today = service.user_today(profile)
    sort = filters.sort or profile.job_sort
    jobs = (await db.scalars(service.list_query(user.id, filters, profile, sort, today))).all()
    return StreamingResponse(
        csv_lines(jobs, profile, today),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="jobs-{today.isoformat()}.csv"'},
    )


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(body: JobCreate, user: CurrentUser, db: DbSession) -> JobOut:
    profile = await get_profile(db, user.id)
    today = service.user_today(profile)
    job = await service.create_job(db, user.id, body, today)
    await db.commit()
    return service.to_out(job, profile, today)


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession) -> JobOut:
    profile = await get_profile(db, user.id)
    job = await service.get_job(db, user.id, job_id)
    return service.to_out(job, profile, service.user_today(profile))


@router.patch("/jobs/{job_id}", response_model=JobOut)
async def update_job(
    job_id: uuid.UUID, body: JobUpdate, user: CurrentUser, db: DbSession
) -> JobOut:
    profile = await get_profile(db, user.id)
    today = service.user_today(profile)
    job = await service.update_job(db, user.id, job_id, body, today)
    await db.commit()
    return service.to_out(job, profile, today)


@router.post("/jobs/{job_id}/snooze", response_model=JobOut)
async def snooze_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession) -> JobOut:
    """Snooze 3 days: moves the follow-up date to today + 3."""
    profile = await get_profile(db, user.id)
    today = service.user_today(profile)
    job = await service.snooze_job(db, user.id, job_id, today)
    await db.commit()
    return service.to_out(job, profile, today)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    await service.delete_job(db, user.id, job_id)
    await db.commit()
