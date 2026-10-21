from types import SimpleNamespace

import pytest

from app.modules.suggestions.ranking import experience_fit, level_of, location_fit, score_opening


def profile(role="Backend Engineer", years=2, cities=("Bengaluru",), skills=("Python",)):
    return SimpleNamespace(
        target_role=role,
        years_experience=years,
        preferred_cities=list(cities),
        skills=list(skills),
    )


def opening(title, location="Bengaluru, India", department=None):
    return SimpleNamespace(title=title, location=location, department=department, posted_at=None)


@pytest.mark.parametrize(
    ("title", "band"),
    [
        ("Software Engineer", (1, 5)),
        ("Senior Software Engineer", (4, 10)),
        ("Staff Engineer", (7, 40)),
        ("Principal Engineer", (10, 40)),
        ("Software Engineer II", (2, 5)),
        ("Software Engineer III", (4, 10)),
        ("SDE-1", (0, 2)),
        ("Junior Developer", (0, 2)),
        ("Software Engineering Intern", (0, 0)),
        ("Engineer, 6+ years", (6, 9)),
    ],
)
def test_level_comes_from_the_title(title, band):
    assert level_of(title)[:2] == band


def test_experience_fit_falls_off_and_cuts_off():
    assert experience_fit(3, (1, 5)) == 1.0
    assert experience_fit(3, (4, 10)) == pytest.approx(2 / 3)
    assert experience_fit(1, (4, 10)) is None  # asks 3 more years than they have
    assert experience_fit(8, (0, 2)) is None  # far above the role


def test_role_is_a_strict_gate():
    p = profile(role="Backend Engineer")
    assert score_opening(opening("Backend Engineer"), p)
    assert score_opening(opening("Frontend Engineer"), p) is None
    assert score_opening(opening("Software Engineer"), p) is None


def test_relaxed_role_passes_only_when_asked():
    p = profile(role="Backend Engineer")
    fit = score_opening(opening("Software Engineer"), p, allow_relaxed=True)
    assert fit and fit.relaxed
    strict = score_opening(opening("Backend Engineer"), p, allow_relaxed=True)
    assert strict and not strict.relaxed and strict.sort_key > fit.sort_key


def test_generic_target_role_accepts_any_engineering_title():
    p = profile(role="Software Engineer")
    assert score_opening(opening("Backend Engineer"), p)
    assert score_opening(opening("Product Manager"), p) is None


def test_skills_rank_the_survivors():
    p = profile(role="Backend Engineer", skills=("Python", "Go"))
    plain = score_opening(opening("Backend Engineer"), p)
    skilled = score_opening(opening("Backend Engineer (Python, Go)"), p)
    one = score_opening(opening("Backend Engineer, Python"), p)
    assert plain and skilled and one
    assert skilled.skills == ("Python", "Go")
    assert skilled.sort_key > one.sort_key > plain.sort_key


def test_skills_never_rescue_a_failed_gate():
    p = profile(role="Backend Engineer", skills=("Python",), years=1)
    assert score_opening(opening("Senior Backend Engineer, Python"), p) is None
    assert score_opening(opening("Backend Engineer, Python", "London"), p) is None


def test_reason_names_role_skills_level_and_place():
    p = profile(role="Backend Engineer", skills=("Python",))
    fit = score_opening(opening("Backend Engineer II, Python"), p)
    assert fit and fit.reason() == "Role match · Python · level 2 · Bengaluru"


def test_years_decide_between_levels():
    p = profile(years=6)
    mid = score_opening(opening("Backend Engineer II"), p)
    senior = score_opening(opening("Senior Backend Engineer"), p)
    assert mid and senior and senior.total > mid.total


def test_senior_roles_are_dropped_for_a_junior_profile():
    assert score_opening(opening("Senior Backend Engineer"), profile(years=1)) is None
    assert score_opening(opening("Senior Backend Engineer"), profile(years=3)) is not None


def test_location_breaks_ties():
    p = profile(cities=("Bengaluru", "Pune"))
    first = score_opening(opening("Backend Engineer", "Bengaluru"), p)
    second = score_opening(opening("Backend Engineer", "Pune"), p)
    india = score_opening(opening("Backend Engineer", "India"), p)
    assert first and second and india
    assert first.total > second.total > india.total


def test_city_aliases_match():
    assert location_fit("Bangalore, KA", ["Bengaluru"]) == (1.0, "Bengaluru")
    assert location_fit("London", ["Bengaluru"]) is None


def test_non_software_role_needs_a_word_match():
    p = profile(role="Product Designer", skills=())
    assert score_opening(opening("Product Designer"), p)
    assert score_opening(opening("Backend Engineer"), p) is None


def test_missing_years_assume_a_junior_profile():
    assert score_opening(opening("Senior Backend Engineer"), profile(years=None)) is None
    assert score_opening(opening("Backend Engineer"), profile(years=None)) is not None


@pytest.mark.parametrize(
    "title",
    [
        "Software Engineer (C and Python, Linux OS, networking domain, "
        "L2/L3 forwarding protocols| 4-9 Years))",
        "Software Development Engineer \u2013 C/C++ | Linux | Networking Protocols | "
        "Layer 2/Layer 3 | 8-12 Yrs",
    ],
)
def test_year_ranges_in_titles_drop_roles_for_a_one_year_profile(title):
    p = profile(role="Software Engineer", years=1, skills=("Python",))
    assert level_of(title)[:2] in {(4, 9), (8, 12)}
    assert score_opening(opening(title, "Bangalore, India"), p, allow_relaxed=True) is None
    assert score_opening(opening(title, "Bangalore, India"), profile(years=6), allow_relaxed=True)
