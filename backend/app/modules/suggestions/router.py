import uuid
from datetime import datetime

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.core.ratelimit import Limit, limiter
from app.modules.auth.dependencies import CurrentUser, DbSession
from app.modules.jobs import service as jobs_service
from app.modules.jobs.schemas import JobOut
from app.modules.profiles.service import get_profile
from app.modules.suggestions import service
from app.modules.suggestions.tasks import defer_rank, refresh_openings

router = APIRouter(prefix="/suggestions", tags=["suggestions"])

REFRESH_PER_USER = Limit("suggestions_refresh", 5, 24 * 60 * 60)


class SuggestionOut(BaseModel):
    id: uuid.UUID
    company: str
    title: str
    location: str | None
    url: str
    reason: str
    posted_at: datetime | None


class SuggestionList(BaseModel):
    suggestions: list[SuggestionOut]


@router.get("", response_model=SuggestionList)
async def list_suggestions(user: CurrentUser, db: DbSession) -> SuggestionList:
    rows = await service.list_suggestions(db, user.id)
    return SuggestionList(
        suggestions=[
            SuggestionOut(
                id=s.id,
                company=o.company,
                title=o.title,
                location=o.location,
                url=o.url,
                reason=s.reason,
                posted_at=o.posted_at,
            )
            for s, o in rows
        ]
    )


@router.post("/refresh", status_code=status.HTTP_202_ACCEPTED)
async def refresh(user: CurrentUser, db: DbSession) -> dict[str, str]:
    """Re-rank now (a few times a day). On a fresh install, fetch the boards first."""
    limiter.hit(REFRESH_PER_USER, str(user.id))
    if await service.openings_count(db) == 0:
        await refresh_openings.defer_async(timestamp=0, rank_after=True)
    else:
        await defer_rank(user.id)
    return {"status": "Finding openings for you. This takes a minute."}


@router.post("/{suggestion_id}/add", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def add_to_tracker(suggestion_id: uuid.UUID, user: CurrentUser, db: DbSession) -> JobOut:
    profile = await get_profile(db, user.id)
    today = jobs_service.user_today(profile)
    job = await service.add_to_tracker(db, user.id, suggestion_id, today)
    await db.commit()
    return jobs_service.to_out(job, profile, today)


@router.post("/{suggestion_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss(suggestion_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    await service.dismiss(db, user.id, suggestion_id)
    await db.commit()
