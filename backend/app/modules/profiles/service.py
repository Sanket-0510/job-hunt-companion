import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profiles.models import Profile
from app.modules.profiles.schemas import ProfileUpdate


def create_empty_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Called in the same transaction that creates the user."""
    profile = Profile(user_id=user_id)
    db.add(profile)
    return profile


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    # Every user gets a profile at signup, so this is never None.
    return await db.get(Profile, user_id)


async def update_profile(db: AsyncSession, user_id: uuid.UUID, changes: ProfileUpdate) -> Profile:
    profile = await get_profile(db, user_id)
    # Only fields the client sent; an explicit null clears the field.
    for field, value in changes.model_dump(exclude_unset=True).items():
        if value is None and field in _NOT_NULL:
            continue
        if field in _URL_FIELDS and value is not None:
            value = str(value)
        setattr(profile, field, value)
    await db.flush()
    await db.refresh(profile)
    return profile


async def mark_onboarded(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    profile = await get_profile(db, user_id)
    if profile.onboarded_at is None:
        profile.onboarded_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(profile)
    return profile


# Columns with NOT NULL defaults: a null in PATCH leaves them unchanged.
_NOT_NULL = {
    "preferred_cities",
    "skills",
    "past_companies",
    "education",
    "default_follow_up_days",
    "reminder_channel",
    "reminder_time",
    "timezone",
    "job_sort",
}
_URL_FIELDS = {"linkedin_url", "resume_link"}
