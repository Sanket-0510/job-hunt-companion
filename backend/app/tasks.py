"""Procrastinate app shared by the API (defers tasks) and the worker (runs them).

Uses the direct Postgres connection: the worker relies on LISTEN/NOTIFY.
"""

import procrastinate

from app.core.config import get_settings

task_app = procrastinate.App(
    connector=procrastinate.PsycopgConnector(
        conninfo=get_settings().database_direct_url,
        min_size=get_settings().task_pool_min,
        max_size=get_settings().task_pool_max,
        kwargs={"options": "-c application_name=job-companion-tasks"},
    ),
    # Modules whose @task_app.task functions the worker must know about.
    import_paths=[
        "app.modules.resumes.tasks",
        "app.modules.reminders.tasks",
        "app.modules.suggestions.tasks",
    ],
)
