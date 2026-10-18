"""Read live postings from public job-board APIs (Greenhouse, Lever, Ashby). No scraping."""

from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

USER_AGENT = "JobHuntCompanion/0.1 (job suggestions; contact via app)"


@dataclass(frozen=True)
class RawOpening:
    external_id: str
    title: str
    location: str | None
    department: str | None
    url: str
    posted_at: datetime | None


def _iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _greenhouse(data: dict) -> list[RawOpening]:
    return [
        RawOpening(
            external_id=str(j["id"]),
            title=j["title"],
            location=(j.get("location") or {}).get("name"),
            department=None,
            url=j["absolute_url"],
            posted_at=_iso(j.get("first_published") or j.get("updated_at")),
        )
        for j in data.get("jobs", [])
    ]


def _lever(data: list) -> list[RawOpening]:
    out = []
    for j in data:
        cats = j.get("categories") or {}
        locations = cats.get("allLocations") or [cats.get("location")]
        out.append(
            RawOpening(
                external_id=j["id"],
                title=j["text"],
                location=", ".join(loc for loc in locations if loc) or None,
                department=cats.get("team") or cats.get("department"),
                url=j["hostedUrl"],
                posted_at=datetime.fromtimestamp(j["createdAt"] / 1000, UTC)
                if j.get("createdAt")
                else None,
            )
        )
    return out


def _ashby(data: dict) -> list[RawOpening]:
    out = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        locations = [j.get("location")] + [
            s.get("location") for s in j.get("secondaryLocations") or []
        ]
        location = ", ".join(loc for loc in locations if loc) or None
        if j.get("isRemote") and location and "remote" not in location.lower():
            location += " (Remote)"
        out.append(
            RawOpening(
                external_id=j["id"],
                title=j["title"],
                location=location,
                department=j.get("department"),
                url=j["jobUrl"],
                posted_at=_iso(j.get("publishedAt")),
            )
        )
    return out


MAX_PER_BOARD = 300  # big employers (Accenture, Citi) list thousands; the first pages are enough


async def _smartrecruiters(client: httpx.AsyncClient, slug: str) -> list[RawOpening]:
    """SmartRecruiters public postings API, India only."""
    out: list[RawOpening] = []
    offset = 0
    while offset < MAX_PER_BOARD:
        r = await client.get(
            f"https://api.smartrecruiters.com/v1/companies/{slug}/postings",
            params={"limit": 100, "offset": offset, "country": "in"},
            headers={"User-Agent": USER_AGENT},
        )
        r.raise_for_status()
        data = r.json()
        for j in data.get("content", []):
            loc = j.get("location") or {}
            out.append(
                RawOpening(
                    external_id=j["id"],
                    title=j["name"],
                    location=loc.get("fullLocation") or loc.get("city"),
                    department=(j.get("department") or {}).get("label")
                    or (j.get("function") or {}).get("label"),
                    url=f"https://jobs.smartrecruiters.com/{slug}/{j['id']}",
                    posted_at=_iso(j.get("releasedDate")),
                )
            )
        offset += 100
        if offset >= data.get("totalFound", 0):
            break
    return out


async def _workday(client: httpx.AsyncClient, slug: str) -> list[RawOpening]:
    """Workday career-site feed.

    slug is "tenant.host/site", for example "nvidia.wd5/NVIDIAExternalCareerSite".
    """
    host_part, site = slug.split("/", 1)
    tenant = host_part.split(".", 1)[0]
    base = f"https://{host_part}.myworkdayjobs.com"
    out: list[RawOpening] = []
    offset = 0
    while offset < MAX_PER_BOARD:
        r = await client.post(
            f"{base}/wday/cxs/{tenant}/{site}/jobs",
            json={"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": "india"},
            headers={"User-Agent": USER_AGENT},
        )
        r.raise_for_status()
        data = r.json()
        postings = data.get("jobPostings", [])
        for j in postings:
            path = j.get("externalPath")
            if not path:
                continue  # sponsored or placeholder entries have no page
            out.append(
                RawOpening(
                    external_id=path.rsplit("_", 1)[-1] if "_" in path else path,
                    title=j["title"],
                    location=j.get("locationsText"),
                    department=None,
                    url=f"{base}/en-US/{site}{path}",
                    posted_at=None,
                )
            )
        offset += 20
        if not postings or offset >= data.get("total", 0):
            break
    return out


async def fetch_board(client: httpx.AsyncClient, provider: str, slug: str) -> list[RawOpening]:
    """All current postings on one board. Raises httpx errors so the caller keeps old rows."""
    if provider == "smartrecruiters":
        return await _smartrecruiters(client, slug)
    if provider == "workday":
        return await _workday(client, slug)
    url, parse = ENDPOINTS[provider]
    response = await client.get(url.format(slug=slug), headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    return parse(response.json())


ENDPOINTS = {
    "greenhouse": ("https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", _greenhouse),
    "lever": ("https://api.lever.co/v0/postings/{slug}?mode=json", _lever),
    "ashby": ("https://api.ashbyhq.com/posting-api/job-board/{slug}", _ashby),
}
