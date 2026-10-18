"""Background worker: resume parsing, morning emails, job-board refresh and suggestions.

Queues: "resumes" and "reminders" (quick, user-facing) and "suggestions" (slow: reads every
company board). Run everything in one process, or split the slow queue into its own worker so
a long board refresh never delays a resume or an email:

    uv run python -m app.worker                          # all queues
    uv run python -m app.worker resumes reminders        # quick jobs
    uv run python -m app.worker suggestions              # board refresh and ranking
"""

import asyncio
import logging
import sys

from app.core.config import get_settings
from app.tasks import task_app

KNOWN_QUEUES = {"resumes", "reminders", "suggestions"}


async def main(queues: list[str] | None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    async with task_app.open_async():
        await task_app.run_worker_async(
            queues=queues or None, concurrency=get_settings().worker_concurrency
        )


if __name__ == "__main__":
    wanted = sys.argv[1:]
    unknown = set(wanted) - KNOWN_QUEUES
    if unknown:
        sys.exit(f"Unknown queue(s): {', '.join(sorted(unknown))}. Known: {sorted(KNOWN_QUEUES)}")
    asyncio.run(main(wanted))
