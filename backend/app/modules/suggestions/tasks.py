import logging
import uuid

from procrastinate.exceptions import AlreadyEnqueued

from app.core.db import SessionLocal
from app.modules.suggestions import service
from app.tasks import task_app

logger = logging.getLogger(__name__)


@task_app.periodic(cron="15 */6 * * *", periodic_id="refresh_openings")
@task_app.task(name="refresh_openings", queue="suggestions", queueing_lock="refresh_openings")
async def refresh_openings(timestamp: int = 0, rank_after: bool = True) -> None:
    """Every 6 hours: re-read all company boards, then re-rank suggestions for every user."""
    async with SessionLocal() as db:
        stats = await service.refresh_openings(db)
        logger.info("openings refreshed: %s", stats)
        users = await service.users_to_rank(db) if rank_after else []
    for user_id in users:
        await defer_rank(user_id)


async def defer_rank(user_id: uuid.UUID) -> None:
    try:
        await rank_suggestions.configure(queueing_lock=f"rank:{user_id}").defer_async(
            user_id=str(user_id)
        )
    except AlreadyEnqueued:
        pass


@task_app.task(name="rank_suggestions", queue="suggestions")
async def rank_suggestions(user_id: str) -> None:
    async with SessionLocal() as db:
        count = await service.rank_for_user(db, uuid.UUID(user_id))
    logger.info("ranked %s suggestion(s) for %s", count, user_id)
