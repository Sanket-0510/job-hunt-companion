import pytest

from app.core.ratelimit import Limit, RateLimited, RateLimiter


def test_blocks_after_max_hits_and_separates_keys():
    limiter = RateLimiter()
    limit = Limit("t", 3, 60)
    for _ in range(3):
        limiter.hit(limit, "a@b.co")
    with pytest.raises(RateLimited) as exc:
        limiter.hit(limit, "a@b.co")
    assert 0 < exc.value.retry_after <= 61
    limiter.hit(limit, "other@b.co")  # different key is unaffected


def test_window_expires(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", lambda: clock[0])
    limiter = RateLimiter()
    limit = Limit("t", 1, 10)
    limiter.hit(limit, "k")
    clock[0] += 11
    limiter.hit(limit, "k")
