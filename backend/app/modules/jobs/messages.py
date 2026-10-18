"""Copy-ready referral and follow-up messages (spec F7, section 6) and LinkedIn links (F8)."""

import math
import re
from urllib.parse import urlencode

from pydantic import BaseModel

from app.modules.jobs.models import Job
from app.modules.profiles.models import Profile

DEFAULT_REFERRAL = """Hi [Name],

I'm {full name}, a software engineer with {years}+ years of experience. {highlights}
My stack is {skills}.
I'm interested in the [Role] position at [Company] and would be grateful if you could refer me.
Resume: {resume link}
Job link: [link]

Thank you for your time!"""

DEFAULT_FOLLOW_UP = """Hi [Name],

Just following up on my earlier message about the [Role] position at [Company]. I'd really appreciate a referral if you're able to.
Resume: {resume link}
Job link: [link]

Thanks again for your time!"""

# Shown in Settings next to the template boxes.
FIELDS = {
    "[Name]": "Left blank for you to type the person's name",
    "[Role]": "Job role",
    "[Company]": "Job company",
    "[link]": "Job apply link",
    "{full name}": "Your name",
    "{years}": "Your years of experience, rounded down",
    "{skills}": "Your skills, comma separated",
    "{highlights}": "Your one-line highlights",
    "{resume link}": "Your resume link (Google Drive)",
}

# Any placeholder left in the output is a blank the UI highlights for the user to fill.
_PLACEHOLDER = re.compile(r"\[[^\[\]\n]{1,30}\]|\{[^{}\n]{1,30}\}")

LINKEDIN_PEOPLE_SEARCH = "https://www.linkedin.com/search/results/people/"


class Message(BaseModel):
    text: str
    blanks: list[str]  # placeholders still unfilled, in order of appearance


class JobMessages(BaseModel):
    referral: Message
    follow_up: Message


class LinkedInLinks(BaseModel):
    company_page: str | None
    recruiter: str | None
    find_recruiters: str
    find_engineers: str


def _years(profile: Profile) -> str | None:
    if profile.years_experience is None:
        return None
    return str(math.floor(profile.years_experience))


def _values(profile: Profile, job: Job) -> dict[str, str | None]:
    return {
        "[Role]": job.role,
        "[Company]": job.company,
        "[link]": job.apply_url,
        "{full name}": profile.full_name,
        "{years}": _years(profile),
        "{skills}": ", ".join(profile.skills) or None,
        "{highlights}": profile.highlights,
        "{resume link}": profile.resume_link,
    }


def fill(template: str, profile: Profile, job: Job) -> Message:
    values = {k: v for k, v in _values(profile, job).items() if v}
    # Single pass so a value that itself contains "[x]" is never re-expanded.
    text = _PLACEHOLDER.sub(lambda m: values.get(m.group(0), m.group(0)), template)
    blanks = list(dict.fromkeys(m.group(0) for m in _PLACEHOLDER.finditer(template)
                                if m.group(0) not in values))  # fmt: skip
    return Message(text=text, blanks=blanks)


def job_messages(profile: Profile, job: Job) -> JobMessages:
    return JobMessages(
        referral=fill(profile.referral_template or DEFAULT_REFERRAL, profile, job),
        follow_up=fill(profile.follow_up_template or DEFAULT_FOLLOW_UP, profile, job),
    )


def _people_search(keywords: str) -> str:
    return f"{LINKEDIN_PEOPLE_SEARCH}?{urlencode({'keywords': keywords})}"


def linkedin_links(job: Job) -> LinkedInLinks:
    """Plain links to LinkedIn's own search. The app never acts on LinkedIn."""
    return LinkedInLinks(
        company_page=job.company_linkedin_url,
        recruiter=job.recruiter_linkedin_url,
        find_recruiters=_people_search(f"{job.company} recruiter"),
        find_engineers=_people_search(f"{job.company} software engineer"),
    )
