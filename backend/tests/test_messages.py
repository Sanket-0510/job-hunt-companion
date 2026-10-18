from decimal import Decimal
from urllib.parse import parse_qs, urlsplit

from app.modules.jobs.messages import fill, job_messages, linkedin_links
from app.modules.jobs.models import Job
from app.modules.profiles.models import Profile


def _profile(**kw) -> Profile:
    base = dict(
        full_name="Asha Rao",
        years_experience=Decimal("2.5"),
        skills=["Python", "Go"],
        highlights="I've worked at PhonePe.",
        resume_link="https://drive.google.com/x",
        referral_template=None,
        follow_up_template=None,
    )
    return Profile(**(base | kw))


JOB = Job(company="Razorpay", role="SDE-1", apply_url="https://razorpay.com/jobs/1")


def test_default_referral_filled():
    msg = job_messages(_profile(), JOB).referral
    assert "I'm Asha Rao, a software engineer with 2+ years" in msg.text
    assert "My stack is Python, Go." in msg.text
    assert "[Role]" not in msg.text and "SDE-1 position at Razorpay" in msg.text
    assert "Job link: https://razorpay.com/jobs/1" in msg.text
    assert msg.blanks == ["[Name]"]


def test_missing_values_stay_as_blanks():
    job = Job(company="Zepto", role="SRE", apply_url=None)
    msg = job_messages(_profile(resume_link=None, highlights=None), job).referral
    assert msg.blanks == ["[Name]", "{highlights}", "{resume link}", "[link]"]
    assert "Resume: {resume link}" in msg.text


def test_custom_template_used():
    p = _profile(follow_up_template="Hey [Name], any update on [Company]?")
    assert job_messages(p, JOB).follow_up.text == "Hey [Name], any update on Razorpay?"


def test_values_not_re_expanded():
    job = Job(company="[Role] Inc", role="SDE", apply_url=None)
    assert fill("[Company] / [Role]", _profile(), job).text == "[Role] Inc / SDE"


def test_linkedin_search_links():
    links = linkedin_links(Job(company="Swiggy & Co", company_linkedin_url=None))
    q = parse_qs(urlsplit(links.find_engineers).query)
    assert q["keywords"] == ["Swiggy & Co software engineer"]
    assert links.find_recruiters.startswith("https://www.linkedin.com/search/results/people/")
    assert links.company_page is None
