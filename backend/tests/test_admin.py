from app.core.config import Settings


def make(admin_emails: str) -> Settings:
    return Settings(
        _env_file=None,
        database_url="postgresql://x",
        session_secret="s",
        admin_emails=admin_emails,
    )


def test_admin_emails_are_trimmed_and_lowercased():
    assert make(" A@x.com , b@x.com,, ").admin_email_set == {"a@x.com", "b@x.com"}


def test_nobody_is_admin_by_default():
    assert make("").admin_email_set == frozenset()
