import logging
import uuid
from datetime import date

from procrastinate import RetryStrategy
from procrastinate.exceptions import AlreadyEnqueued

from app.core.db import SessionLocal
from app.integrations.notifications.base import get_email_sender
from app.modules.reminders.service import build_digest, claim_due_digests
from app.tasks import task_app

logger = logging.getLogger(__name__)


@task_app.periodic(cron="*/15 * * * *", periodic_id="schedule_digests")
@task_app.task(name="schedule_digests", queue="reminders", queueing_lock="schedule_digests")
async def schedule_digests(timestamp: int) -> None:
    """Every 15 minutes: queue one digest per user whose morning time has arrived."""
    async with SessionLocal() as db:
        claimed = await claim_due_digests(db)
    for user_id, local_today in claimed:
        try:
            await send_digest.configure(
                queueing_lock=f"digest:{user_id}:{local_today}"
            ).defer_async(user_id=str(user_id), local_today=local_today.isoformat())
        except AlreadyEnqueued:
            pass
    if claimed:
        logger.info("queued %s digest(s)", len(claimed))


@task_app.task(
    name="send_digest",
    queue="reminders",
    # Brevo hiccups: retry a few times with backoff before giving up.
    retry=RetryStrategy(max_attempts=4, exponential_wait=30),
)
async def send_digest(user_id: str, local_today: str) -> None:
    async with SessionLocal() as db:
        message = await build_digest(db, uuid.UUID(user_id), date.fromisoformat(local_today))
    if message is None:
        return  # nothing due: no email
    await get_email_sender().send(message)
