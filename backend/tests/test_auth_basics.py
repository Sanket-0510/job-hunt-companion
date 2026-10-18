"""Auth checks that need no database. Flows against Postgres come with the DB test setup."""

from fastapi.testclient import TestClient

from app.core.security import hash_password, hash_token, new_token, verify_password
from app.main import app

client = TestClient(app)


def test_password_hash_roundtrip():
    h = hash_password("correct horse")
    assert h.startswith("$argon2id$")
    assert verify_password(h, "correct horse")
    assert not verify_password(h, "wrong")
    assert not verify_password("not-a-hash", "x")


def test_new_token_stores_only_hash():
    raw, stored = new_token()
    assert len(raw) >= 40
    assert stored == hash_token(raw)
    assert raw.encode() not in stored


def test_me_without_cookie_is_401():
    r = client.get("/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"


def test_signup_rejects_short_password():
    r = client.post("/auth/signup", json={"email": "a@b.co", "password": "short"})
    assert r.status_code == 422


def test_google_login_unconfigured_is_503():
    r = client.get("/auth/google/login")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "google_not_configured"


def test_routes_registered():
    paths = set(app.openapi()["paths"])
    assert {
        "/auth/signup",
        "/auth/login",
        "/auth/logout",
        "/auth/me",
        "/auth/password-reset/request",
        "/auth/password-reset/confirm",
        "/auth/google/login",
        "/auth/google/callback",
    } <= paths
