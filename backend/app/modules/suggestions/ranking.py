"""Score one opening against one profile on the three things job seekers search by.

In order of weight: the role (45%), the years of experience against the level the title implies
(35%), and the location (20%). Openings only carry a title, a team and a location, so the level is
read from the title. `score_opening` returns None for an opening that must not be suggested at all
(wrong kind of role, or a level far from the person's years).
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

W_ROLE, W_EXPERIENCE, W_LOCATION = 0.45, 0.35, 0.20

# Assumed when the profile has no years: keeps senior roles out, like the old title filter did.
DEFAULT_YEARS = 1.0
# How far (in years) a level may sit from the person's years. Stretching up is fine for a little;
# being far above the role is not.
MAX_STRETCH_UP = 2  # role asks for more than they have
MAX_OVERQUALIFIED = 1  # role asks for less than they have

WORD = re.compile(r"[a-z0-9+#.]+")
ENGINEERING_TITLE = re.compile(
    r"\b(engineer|developer|sde|swe|programmer|sre|devops|backend|frontend|full[- ]?stack|"
    r"software|platform|infrastructure|data engineer|mobile|android|ios)\b",
    re.I,
)
# Software target roles are matched against engineering titles. Any other target role (product,
# design, sales, finance...) is matched by the words of the role against title and department.
SOFTWARE_ROLE = re.compile(
    r"\b(engineer|developer|dev|sde|swe|programmer|software|sre|devops|backend|back[- ]?end|"
    r"frontend|front[- ]?end|full[- ]?stack|web|mobile|android|ios|data|machine learning|ml|ai|"
    r"cloud|platform|infrastructure|qa|sdet|test|security|python|java|javascript|react|node|golang)\b",
    re.I,
)
# Words that say nothing about the kind of job when matching a non-software target role.
ROLE_STOPWORDS = frozenset(
    {"and", "the", "for", "with", "manager", "executive", "associate", "assistant", "junior",
     "senior", "lead", "head", "trainee", "intern", "specialist", "officer", "analyst"}
)  # fmt: skip
# Words that every software title shares, so they don't tell one engineering role from another.
GENERIC_SOFTWARE = frozenset(
    {"engineer", "engineering", "developer", "software", "sde", "swe", "programmer", "dev",
     "and", "the", "for", "with", "senior", "junior", "lead", "sr", "jr", "i", "ii", "iii"}
)  # fmt: skip
# Boards spell Indian cities both ways.
CITY_ALIASES = {
    "bengaluru": "bangalore",
    "bangalore": "bengaluru",
    "gurugram": "gurgaon",
    "gurgaon": "gurugram",
    "mumbai": "bombay",
    "chennai": "madras",
}


class _OpeningLike(Protocol):
    title: str
    department: str | None
    location: str | None
    posted_at: datetime | None


class _ProfileLike(Protocol):
    target_role: str | None
    skills: list[str]
    preferred_cities: list[str]
    years_experience: object


# ---------------------------------------------------------------- text helpers


def _norm(text: str | None) -> str:
    t = (text or "").lower()
    t = re.sub(r"\b(back|front)[- ]end\b", r"\1end", t)
    return re.sub(r"\bfull[- ]stack\b", "fullstack", t)


def _tokens(text: str | None) -> set[str]:
    return set(WORD.findall(_norm(text)))


def is_software_profile(profile: _ProfileLike) -> bool:
    return not profile.target_role or bool(SOFTWARE_ROLE.search(profile.target_role))


def _role_words(profile: _ProfileLike) -> set[str]:
    """The distinctive words of a non-software target role, used to match titles and departments."""
    return {w for w in _tokens(profile.target_role) if len(w) >= 3 and w not in ROLE_STOPWORDS}


# ---------------------------------------------------------------- level from the title

_YEARS_IN_TITLE = re.compile(r"\b(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?|yoe)\b", re.I)
_SUFFIX_LEVEL = re.compile(
    r"\b(?:engineer|developer|sde|swe|programmer|analyst|designer)\s*[-:]?\s*(iii|ii|i|3|2|1)\b",
    re.I,
)
_TOP = re.compile(
    r"\b(chief|vp|vice president|director|head|distinguished|fellow|principal|architect)\b", re.I
)
_LEAD = re.compile(r"\b(staff|lead)\b", re.I)
_MANAGER = re.compile(r"\bmanager\b", re.I)
_SENIOR = re.compile(r"\b(senior|sr\.?)\b", re.I)
_ENTRY = re.compile(
    r"\b(intern|internship|trainee|apprentice|fresher|graduate|campus|new grad)\b", re.I
)
_JUNIOR = re.compile(r"\b(junior|jr\.?|associate|entry[- ]level)\b", re.I)


def level_of(title: str, software: bool = True) -> tuple[float, float, str]:
    """(min years, max years, label) a title implies. Plain titles fit 1 to 5 years."""
    if m := _YEARS_IN_TITLE.search(title):
        n = int(m.group(1))
        return n, n + 3, f"asks {n}+ years"
    if _ENTRY.search(title):
        return 0, 0, "entry level"
    if _TOP.search(title):
        return 10, 40, "principal level"
    if _LEAD.search(title) or (software and _MANAGER.search(title)):
        return 7, 40, "lead level"
    if _SENIOR.search(title):
        return 4, 10, "senior level"
    if m := _SUFFIX_LEVEL.search(title):
        step = {"i": 1, "1": 1, "ii": 2, "2": 2, "iii": 3, "3": 3}[m.group(1).lower()]
        return {1: (0, 2, "level 1"), 2: (2, 5, "level 2"), 3: (4, 10, "level 3")}[step]
    if _JUNIOR.search(title):
        return 0, 2, "junior level"
    return 1, 5, "open to 1-5 years"


def experience_fit(years: float, band: tuple[float, float]) -> float | None:
    """1.0 inside the band, falling off with distance. None when the level is too far off."""
    lo, hi = band
    if years < lo:
        gap = lo - years
        return None if gap > MAX_STRETCH_UP else 1 - gap / (MAX_STRETCH_UP + 1)
    if years > hi:
        gap = years - hi
        return None if gap > MAX_OVERQUALIFIED else 1 - gap / (MAX_OVERQUALIFIED + 1)
    return 1.0


# ---------------------------------------------------------------- role and location


def role_fit(opening: _OpeningLike, profile: _ProfileLike, software: bool) -> float | None:
    title_words = _tokens(opening.title) | _tokens(opening.department)
    if not software:
        words = _role_words(profile)
        hits = words & title_words
        return 0.4 + 0.6 * len(hits) / len(words) if hits else None
    if not ENGINEERING_TITLE.search(opening.title):
        return None
    wanted = {
        w for w in _tokens(profile.target_role) if w not in GENERIC_SOFTWARE and not w.isdigit()
    }
    share = len(wanted & title_words) / len(wanted) if wanted else 0.5
    text = f" {_norm(opening.title)} {_norm(opening.department)} "
    hits = sum(1 for s in profile.skills if f" {_norm(s).strip()} " in text)
    return 0.35 + 0.45 * share + 0.20 * min(1.0, hits / 2)


def location_fit(location: str | None, cities: list[str]) -> tuple[float, str] | None:
    """1.0 first preferred city, 0.8 another, lower for India only. None if nothing matches."""
    loc = _norm(location)
    if not loc:
        return None
    for i, city in enumerate(cities):
        names = {city.lower(), CITY_ALIASES.get(city.lower(), city.lower())}
        if any(n in loc for n in names):
            return (1.0 if i == 0 else 0.8), city
    if "india" in loc:
        return (0.6 if not cities else 0.35), "India"
    return None


# ---------------------------------------------------------------- combined


@dataclass(frozen=True)
class Fit:
    role: float
    experience: float
    location: float
    total: float  # 0 to 100
    level: str
    place: str

    def reason(self) -> str:
        """A short deterministic reason, used when the model gives none."""
        return f"Fits your role, {self.level}, in {self.place}."[:110]


def score_opening(opening: _OpeningLike, profile: _ProfileLike) -> Fit | None:
    software = is_software_profile(profile)
    role = role_fit(opening, profile, software)
    if role is None:
        return None
    lo, hi, level = level_of(opening.title, software)
    years = (
        float(profile.years_experience) if profile.years_experience is not None else DEFAULT_YEARS
    )
    experience = experience_fit(years, (lo, hi))
    if experience is None:
        return None
    place = location_fit(opening.location, profile.preferred_cities)
    if place is None:
        return None
    location, place_name = place
    total = 100 * (W_ROLE * role + W_EXPERIENCE * experience + W_LOCATION * location)
    return Fit(role, experience, location, round(total, 1), level, place_name)
