import pytest
from pydantic import ValidationError

from app.modules.profiles.schemas import ProfileUpdate


def test_whatsapp_normalised_to_e164():
    assert ProfileUpdate(whatsapp_number="+91 98765-43210").whatsapp_number == "+919876543210"


@pytest.mark.parametrize(
    "body",
    [
        {"whatsapp_number": "9876543210"},
        {"timezone": "India/Delhi"},
        {"reminder_channel": "whatsapp"},
        {"years_experience": 51},
        {"default_follow_up_days": 0},
        {"onboarded_at": "2026-01-01T00:00:00Z"},
    ],
)
def test_rejects_invalid(body):
    with pytest.raises(ValidationError):
        ProfileUpdate(**body)


def test_tag_lists_trimmed_and_deduped():
    p = ProfileUpdate(preferred_cities=[" Bengaluru ", "Pune", "BENGALURU"])
    assert p.preferred_cities == ["Bengaluru", "Pune"]


def test_only_sent_fields_are_set():
    assert ProfileUpdate(full_name="Asha").model_dump(exclude_unset=True) == {"full_name": "Asha"}
