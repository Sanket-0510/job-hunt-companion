from datetime import date

from app.modules.jobs.export import _safe
from app.modules.jobs.models import DirectStatus, Job, JobStage, ReferralStatus
from app.modules.jobs.service import _apply_changes, track_emails
from app.modules.profiles.models import Profile

TODAY = date(2026, 10, 18)


def test_csv_neutralises_formulas():
    assert _safe("=HYPERLINK()") == "'=HYPERLINK()"
    assert _safe("+91 98765") == "'+91 98765"
    assert _safe("Razorpay") == "Razorpay"
    assert _safe(None) == ""


def test_status_changes_fill_dates_once():
    job = Job()
    _apply_changes(job, {"direct_status": DirectStatus.applied}, TODAY)
    assert job.applied_on == TODAY
    _apply_changes(job, {"referral_status": ReferralStatus.asked}, TODAY)
    assert job.asked_on == TODAY

    earlier = date(2026, 10, 1)
    job2 = Job(asked_on=earlier)
    _apply_changes(job2, {"referral_status": ReferralStatus.asked}, TODAY)
    assert job2.asked_on == earlier


def test_due_excludes_offer_and_closed():
    due = Job(follow_up_date=TODAY, stage=JobStage.referral)
    assert due.is_due(TODAY)
    assert not Job(follow_up_date=TODAY, stage=JobStage.offer).is_due(TODAY)
    assert not Job(follow_up_date=TODAY, stage=JobStage.closed).is_due(TODAY)
    assert not Job(follow_up_date=date(2026, 10, 19), stage=JobStage.to_do).is_due(TODAY)


def test_emails_reversed_swaps_tracks():
    profile = Profile(direct_email="me@gmail.com", referral_email="work@gmail.com")
    assert track_emails(Job(emails_reversed=False), profile).direct == "me@gmail.com"
    assert track_emails(Job(emails_reversed=True), profile).direct == "work@gmail.com"
