from types import SimpleNamespace

import pytest

from app.modules.suggestions.service import SOFTWARE_ROLE, _role_words, is_software_profile


@pytest.mark.parametrize(
    "role",
    ["Backend Engineer", "SDE-1 Backend", "Full Stack Developer", "Data Engineer", "DevOps"],
)
def test_software_roles_use_engineering_titles(role):
    assert SOFTWARE_ROLE.search(role)
    assert is_software_profile(SimpleNamespace(target_role=role))


def test_empty_target_role_counts_as_software():
    assert is_software_profile(SimpleNamespace(target_role=None))


@pytest.mark.parametrize("role", ["Prosthodontist", "Product Designer", "Chartered Accountant"])
def test_other_roles_are_matched_by_their_words(role):
    assert not is_software_profile(SimpleNamespace(target_role=role))


def test_role_words_drop_generic_words():
    profile = SimpleNamespace(target_role="Senior Product Marketing Manager")
    assert _role_words(profile) == {"product", "marketing"}
