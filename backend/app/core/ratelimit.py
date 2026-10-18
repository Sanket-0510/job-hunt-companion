"""In-memory sliding-window rate limits for auth endpoints.

Per API process, which is enough for the single-instance pilot (no Redis in v0). If the API
scales out, move the counters to Postgres or Redis behind the same `hit()` call.
"""

import time
from collections import defaultdict, deque
from dataclasses import dataclass

from app.core.errors import AppError


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"

    def __init__(self, retry_after: int):
        minutes = max(1, round(retry_after / 60))
        super().__init__(f"Too many attempts. Try again in {minutes} minute(s).")
        self.retry_after = retry_after


@dataclass(frozen=True)
class Limit:
    name: str
    max_hits: int
    window_seconds: int


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, limit: Limit, key: str) -> None:
        """Record one attempt; raise RateLimited if the window is already full."""
        now = time.monotonic()
        bucket = self._hits[f"{limit.name}:{key}"]
        while bucket and bucket[0] <= now - limit.window_seconds:
            bucket.popleft()
        if len(bucket) >= limit.max_hits:
            raise RateLimited(int(bucket[0] + limit.window_seconds - now) + 1)
        bucket.append(now)
        if len(self._hits) > 50_000:  # drop idle keys so memory stays bounded
            for k in [k for k, v in self._hits.items() if not v][:10_000]:
                del self._hits[k]

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()

LOGIN_PER_EMAIL = Limit("login_email", 10, 15 * 60)
LOGIN_PER_IP = Limit("login_ip", 50, 15 * 60)
SIGNUP_PER_IP = Limit("signup_ip", 10, 60 * 60)
RESET_PER_EMAIL = Limit("reset_email", 5, 60 * 60)
RESET_PER_IP = Limit("reset_ip", 20, 60 * 60)
