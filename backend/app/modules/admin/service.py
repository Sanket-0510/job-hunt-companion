# ruff: noqa: E501  (long SQL lines read better unwrapped)
"""Admin analytics: counts only. No emails, names, resume content or job details leave here."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Calendar days are cut in Indian time, since that is where the users are.
TZ_NAME = "Asia/Kolkata"

COUNTS_SQL = text(
    f"""
    WITH today AS (SELECT (now() AT TIME ZONE '{TZ_NAME}')::date AS d)
    SELECT
      (SELECT count(*) FROM app.users) AS users_total,
      (SELECT count(*) FROM app.users, today WHERE (created_at AT TIME ZONE '{TZ_NAME}')::date = today.d) AS users_today,
      (SELECT count(*) FROM app.users WHERE created_at >= now() - interval '7 days') AS users_7d,
      (SELECT count(*) FROM app.users WHERE created_at >= now() - interval '30 days') AS users_30d,
      (SELECT count(DISTINCT user_id) FROM app.auth_identities) AS users_google,
      (SELECT count(*) FROM app.users WHERE password_hash IS NOT NULL) AS users_password,
      (SELECT count(*) FROM app.profiles WHERE onboarded_at IS NOT NULL) AS users_onboarded,
      (SELECT count(DISTINCT user_id) FROM app.sessions WHERE last_seen_at >= now() - interval '1 day') AS active_1d,
      (SELECT count(DISTINCT user_id) FROM app.sessions WHERE last_seen_at >= now() - interval '7 days') AS active_7d,
      (SELECT count(DISTINCT user_id) FROM app.sessions WHERE last_seen_at >= now() - interval '30 days') AS active_30d,
      (SELECT count(*) FROM app.resumes) AS resumes_total,
      (SELECT count(*) FROM app.resumes WHERE created_at >= now() - interval '7 days') AS resumes_7d,
      (SELECT count(DISTINCT user_id) FROM app.resumes) AS resumes_users,
      (SELECT count(*) FROM app.resumes WHERE parse_status = 'done') AS resumes_done,
      (SELECT count(*) FROM app.resumes WHERE parse_status = 'failed') AS resumes_failed,
      (SELECT count(*) FROM app.resumes WHERE parse_status IN ('pending', 'running')) AS resumes_in_progress,
      (SELECT count(*) FROM app.jobs) AS jobs_total,
      (SELECT count(*) FROM app.jobs WHERE created_at >= now() - interval '7 days') AS jobs_7d,
      (SELECT count(DISTINCT user_id) FROM app.jobs) AS jobs_users,
      (SELECT count(*) FROM app.jobs WHERE direct_status <> 'not_applied') AS jobs_direct_started,
      (SELECT count(*) FROM app.jobs WHERE referral_status <> 'not_asked') AS jobs_referral_started,
      (SELECT count(*) FROM app.suggestions WHERE status = 'added') AS suggestions_added,
      (SELECT count(*) FROM app.suggestions WHERE status = 'dismissed') AS suggestions_dismissed,
      (SELECT count(*) FROM app.suggestions WHERE status = 'new') AS suggestions_waiting,
      (SELECT count(*) FROM app.profiles WHERE reminder_channel = 'email') AS reminders_on,
      (SELECT count(*) FROM app.profiles, today WHERE last_digest_sent_on = today.d) AS digests_today,
      (SELECT count(*) FROM app.profiles, today WHERE last_digest_sent_on >= today.d - 6) AS digests_7d
    """
)

SIGNUPS_SQL = text(
    f"""
    WITH days AS (
      SELECT generate_series(
        (now() AT TIME ZONE '{TZ_NAME}')::date - 29,
        (now() AT TIME ZONE '{TZ_NAME}')::date,
        interval '1 day'
      )::date AS day
    )
    SELECT days.day AS day, count(u.id) AS signups
    FROM days
    LEFT JOIN app.users u ON (u.created_at AT TIME ZONE '{TZ_NAME}')::date = days.day
    GROUP BY days.day
    ORDER BY days.day
    """
)


async def collect_stats(db: AsyncSession) -> dict:
    counts = dict((await db.execute(COUNTS_SQL)).mappings().one())
    signups = [
        {"day": row["day"].isoformat(), "signups": row["signups"]}
        for row in (await db.execute(SIGNUPS_SQL)).mappings()
    ]
    users, with_jobs = counts["users_total"], counts["jobs_users"]
    return {
        "users": {
            "total": users,
            "today": counts["users_today"],
            "last_7_days": counts["users_7d"],
            "last_30_days": counts["users_30d"],
            "with_google": counts["users_google"],
            "with_password": counts["users_password"],
            "onboarded": counts["users_onboarded"],
        },
        "active_users": {
            "last_day": counts["active_1d"],
            "last_7_days": counts["active_7d"],
            "last_30_days": counts["active_30d"],
        },
        "resumes": {
            "total": counts["resumes_total"],
            "last_7_days": counts["resumes_7d"],
            "users_with_resume": counts["resumes_users"],
            "parsed": counts["resumes_done"],
            "failed": counts["resumes_failed"],
            "in_progress": counts["resumes_in_progress"],
        },
        "jobs": {
            "total": counts["jobs_total"],
            "last_7_days": counts["jobs_7d"],
            "users_with_jobs": with_jobs,
            "per_user_average": round(counts["jobs_total"] / with_jobs, 1) if with_jobs else 0,
            "direct_started": counts["jobs_direct_started"],
            "referral_started": counts["jobs_referral_started"],
        },
        "suggestions": {
            "added_to_tracker": counts["suggestions_added"],
            "dismissed": counts["suggestions_dismissed"],
            "waiting": counts["suggestions_waiting"],
        },
        "emails": {
            "reminders_on": counts["reminders_on"],
            "sent_today": counts["digests_today"],
            "sent_last_7_days": counts["digests_7d"],
        },
        "signups_by_day": signups,
    }
