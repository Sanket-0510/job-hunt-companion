import pytest

from app.modules.resumes.schemas import ParsedResume
from app.modules.resumes.tasks import ParseFailed, extract_text


def test_from_llm_cleans_untrusted_output():
    parsed = ParsedResume.from_llm(
        {
            "full_name": "  Asha Rao ",
            "skills": ["Go", "go", 42, "Kafka"],
            "past_companies": [{"company": "PhonePe", "title": "x" * 500}, {"title": "no company"}],
            "education": "not a list",
            "unexpected": "ignored",
        }
    )
    assert parsed.full_name == "Asha Rao"
    assert parsed.skills == ["Go", "Kafka"]
    assert len(parsed.past_companies) == 1
    assert len(parsed.past_companies[0].title) == 200
    assert parsed.education == []


def test_from_llm_empty_reply():
    assert ParsedResume.from_llm({}) == ParsedResume()


def test_extract_text_rejects_garbage():
    with pytest.raises(ParseFailed) as exc:
        extract_text(b"%PDF-1.4 not really a pdf")
    assert exc.value.code in {"unreadable_pdf", "no_text"}
