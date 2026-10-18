from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentUser, DbSession
from app.modules.profiles import service
from app.modules.profiles.models import Profile
from app.modules.profiles.schemas import ProfileOut, ProfileUpdate
from app.modules.suggestions.tasks import defer_rank

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
async def get_profile(user: CurrentUser, db: DbSession) -> Profile:
    return await service.get_profile(db, user.id)


@router.patch("", response_model=ProfileOut)
async def update_profile(body: ProfileUpdate, user: CurrentUser, db: DbSession) -> Profile:
    profile = await service.update_profile(db, user.id, body)
    await db.commit()
    return profile


@router.post("/onboarded", response_model=ProfileOut)
async def mark_onboarded(user: CurrentUser, db: DbSession) -> Profile:
    """'Go to my tracker' at the end of onboarding."""
    profile = await service.mark_onboarded(db, user.id)
    await db.commit()
    # First suggestions right away instead of waiting for the next scheduled run.
    try:
        await defer_rank(user.id)
    except Exception:  # suggestions are a bonus; never fail onboarding over them
        pass
    return profile
