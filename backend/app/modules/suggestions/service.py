"""Fetch openings from boards, pick each user's best few with plain rules, act on suggestions."""

import asyncio
import logging
import uuid
from datetime import UTC, date, datetime

import httpx
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.jobs.models import Job
from app.modules.profiles.models import Profile
from app.modules.suggestions.fetchers import fetch_board
from app.modules.suggestions.models import CompanyBoard, Opening, Suggestion
from app.modules.suggestions.ranking import (  # noqa: F401  (re-exported for callers and tests)
    CITY_ALIASES,
    SOFTWARE_ROLE,
    Fit,
    _role_words,
    evaluate,
    is_software_profile,
)

logger = logging.getLogger(__name__)

TOP_N = 5
SHORTLIST_SIZE = 40
MAX_PER_COMPANY_SHORTLIST = 4
FETCH_CONCURRENCY = 6


class SuggestionNotFound(AppError):
    status_code = 404
    code = "suggestion_not_found"


# ---------------------------------------------------------------- fetching


async def refresh_openings(db: AsyncSession) -> dict[str, int]:
    """Re-read every active board. A board that fails keeps yesterday's rows."""
    boards = (await db.scalars(select(CompanyBoard).where(CompanyBoard.active))).all()
    sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    stats = {"boards": len(boards), "failed": 0, "openings": 0}

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:

        async def one(board: CompanyBoard):
            async with sem:
                try:
                    return board, await fetch_board(client, board.provider, board.slug), None
                except Exception as exc:  # network, 404, bad JSON: keep old rows
                    return board, None, f"{type(exc).__name__}: {str(exc)[:200]}"

        results = await asyncio.gather(*(one(b) for b in boards))

    now = datetime.now(UTC)
    for board, rows, error in results:
        board.last_fetched_at = now
        board.last_error = error
        if rows is None:
            stats["failed"] += 1
            logger.warning("board %s/%s failed: %s", board.provider, board.slug, error)
            continue
        if rows:
            stmt = insert(Opening).values(
                [
                    {
                        "board_id": board.id,
                        "external_id": r.external_id,
                        "company": board.company_name,
                        "title": r.title[:300],
                        "location": (r.location or "")[:300] or None,
                        "department": (r.department or "")[:200] or None,
                        "url": r.url,
                        "posted_at": r.posted_at,
                        "last_seen_at": now,
                    }
                    for r in rows
                ]
            )
            await db.execute(
                stmt.on_conflict_do_update(
                    index_elements=["board_id", "external_id"],
                    set_={
                        "title": stmt.excluded.title,
                        "location": stmt.excluded.location,
                        "department": stmt.excluded.department,
                        "url": stmt.excluded.url,
                        "last_seen_at": now,
                    },
                )
            )
        # Postings that disappeared from the board are closed.
        await db.execute(
            delete(Opening).where(Opening.board_id == board.id, Opening.last_seen_at < now)
        )
        stats["openings"] += len(rows)
    await db.commit()
    return stats


# ---------------------------------------------------------------- ranking


async def _candidates(db: AsyncSession, profile: Profile) -> list[tuple[Opening, Fit]]:
    """Best openings for the profile, scored on role, years of experience and location."""
    # Skip anything already decided on, or already in the tracker under the same company + role.
    decided = select(Suggestion.opening_id).where(
        Suggestion.user_id == profile.user_id, Suggestion.status != "new"
    )
    tracked = {
        (c.lower(), r.lower())
        for c, r in (
            await db.execute(select(Job.company, Job.role).where(Job.user_id == profile.user_id))
        ).all()
    }
    # Narrow by place in SQL first (the openings table holds every board's postings).
    cities = [c.lower() for c in profile.preferred_cities]
    places = ["india", *cities, *(CITY_ALIASES[c] for c in cities if c in CITY_ALIASES)]
    place_match = or_(*(Opening.location.ilike(f"%{p}%") for p in places))
    rows = (await db.scalars(select(Opening).where(Opening.id.not_in(decided), place_match))).all()
    scored: list[tuple[Opening, Fit]] = []
    dropped = {"tracked": 0, "role": 0, "years": 0, "location": 0}
    for o in rows:
        if (o.company.lower(), o.title.lower()) in tracked:
            dropped["tracked"] += 1
            continue
        fit, failed = evaluate(o, profile, allow_relaxed=True)
        if fit is None and failed:
            dropped[failed] += 1
        elif fit is not None:
            scored.append((o, fit))
    logger.info(
        "candidates for %s: %d near their places, %d passed (dropped: %s)",
        profile.user_id,
        len(rows),
        len(scored),
        ", ".join(f"{k} {v}" for k, v in dropped.items()),
    )
    # Loosened-role matches only fill in when strict ones run short.
    if sum(1 for _, f in scored if not f.relaxed) >= TOP_N:
        scored = [(o, f) for o, f in scored if not f.relaxed]
    scored.sort(
        key=lambda p: (*p[1].sort_key, p[0].posted_at or datetime.min.replace(tzinfo=UTC)),
        reverse=True,
    )
    # Spread across companies so one big employer can't crowd out the rest of the shortlist.
    shortlist: list[tuple[Opening, Fit]] = []
    per_company: dict[str, int] = {}
    for o, fit in scored:
        if per_company.get(o.company, 0) >= MAX_PER_COMPANY_SHORTLIST:
            continue
        per_company[o.company] = per_company.get(o.company, 0) + 1
        shortlist.append((o, fit))
        if len(shortlist) == SHORTLIST_SIZE:
            break
    return shortlist


def _diverse(
    candidates: list[tuple[Opening, Fit]], have: list[tuple[uuid.UUID, str]] | None = None
) -> list[tuple[uuid.UUID, str]]:
    """Best first up to TOP_N, at most two per company, added after `have`."""
    out = list(have or [])
    taken = {oid for oid, _ in out}
    names = {o.id: o.company for o, _ in candidates}
    counts: dict[str, int] = {}
    for oid, _ in out:
        counts[names[oid]] = counts.get(names[oid], 0) + 1
    for o, fit in candidates:  # already sorted best first
        if len(out) >= TOP_N:
            break
        if o.id in taken or counts.get(o.company, 0) >= 2:
            continue
        counts[o.company] = counts.get(o.company, 0) + 1
        out.append((o.id, fit.reason()))
    return out


async def rank_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Replace the user's open suggestions with today's best TOP_N. Returns how many."""
    profile = await db.get(Profile, user_id)
    if profile is None:
        return 0
    candidates = await _candidates(db, profile)
    picks = _diverse(candidates)

    # Upsert so a suggestion keeps its id while it stays in the top N (the page may be showing
    # it), then drop the open ones that fell out. Added and dismissed rows are never touched.
    for rank, (opening_id, reason) in enumerate(picks, start=1):
        stmt = insert(Suggestion).values(
            user_id=user_id, opening_id=opening_id, rank=rank, reason=reason
        )
        await db.execute(
            stmt.on_conflict_do_update(
                index_elements=["user_id", "opening_id"],
                set_={"rank": rank, "reason": reason},
                where=Suggestion.status == "new",
            )
        )
    stale = delete(Suggestion).where(Suggestion.user_id == user_id, Suggestion.status == "new")
    if picks:
        stale = stale.where(Suggestion.opening_id.not_in([oid for oid, _ in picks]))
    await db.execute(stale)
    await db.commit()
    return len(picks)


async def users_to_rank(db: AsyncSession) -> list[uuid.UUID]:
    """Onboarded users with at least a target role or skills to match on."""
    return list(
        (
            await db.scalars(
                select(Profile.user_id).where(
                    Profile.onboarded_at.is_not(None),
                    (Profile.target_role.is_not(None)) | (func.cardinality(Profile.skills) > 0),
                )
            )
        ).all()
    )


# ---------------------------------------------------------------- user actions


async def list_suggestions(
    db: AsyncSession, user_id: uuid.UUID
) -> list[tuple[Suggestion, Opening]]:
    rows = await db.execute(
        select(Suggestion, Opening)
        .join(Opening, Opening.id == Suggestion.opening_id)
        .where(Suggestion.user_id == user_id, Suggestion.status == "new")
        .order_by(Suggestion.rank)
    )
    return [(s, o) for s, o in rows.all()]


async def add_to_tracker(
    db: AsyncSession, user_id: uuid.UUID, suggestion_id: uuid.UUID, today: date
) -> Job:
    # Claim it in one statement, so a re-rank running at the same moment can't race us.
    opening_id = await db.scalar(
        update(Suggestion)
        .where(
            Suggestion.id == suggestion_id,
            Suggestion.user_id == user_id,
            Suggestion.status == "new",
        )
        .values(status="added")
        .returning(Suggestion.opening_id)
    )
    opening = await db.get(Opening, opening_id) if opening_id else None
    if opening is None:
        raise SuggestionNotFound("This suggestion was just refreshed. Reload to see the latest.")
    job = Job(
        user_id=user_id,
        company=opening.company,
        role=opening.title,
        location=opening.location,
        apply_url=opening.url,
        source="Suggested (company job board)",
        date_found=today,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def dismiss(db: AsyncSession, user_id: uuid.UUID, suggestion_id: uuid.UUID) -> None:
    await db.execute(
        update(Suggestion)
        .where(Suggestion.id == suggestion_id, Suggestion.user_id == user_id)
        .values(status="dismissed")
    )


async def openings_count(db: AsyncSession) -> int:
    return await db.scalar(select(func.count()).select_from(Opening)) or 0
