import time
import math
import threading
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings


class InMemorySlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter for expensive endpoints.
    Protects multi-modal AI vision requests from denial of service and quota exhaustion.
    """

    def __init__(
        self,
        max_requests: int = 15,
        window_seconds: int = 60,
        detail_message: Optional[str] = None,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.detail_message = detail_message
        self._records: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_rate_limit(self, client_key: str) -> None:
        if settings.ENVIRONMENT == "testing" and self.max_requests <= 0:
            return

        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Clean up old timestamps
            timestamps = self._records.get(client_key, [])
            timestamps = [ts for ts in timestamps if ts > window_start]

            if len(timestamps) >= self.max_requests:
                oldest = timestamps[0]
                retry_after = max(1, math.ceil(oldest + self.window_seconds - now))
                msg = self.detail_message or f"Rate limit exceeded ({self.max_requests} req/{self.window_seconds}s). Please wait before trying again."
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=msg,
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self._records[client_key] = timestamps

    def reset(self) -> None:
        """Clear all rate limiting records (useful for test isolation)."""
        with self._lock:
            self._records.clear()


# Default instance for AI image analysis
analysis_rate_limiter = InMemorySlidingWindowRateLimiter(
    max_requests=settings.RATE_LIMIT_ANALYZE_PER_MINUTE,
    window_seconds=60,
    detail_message="Rate limit exceeded for food image analysis. Please wait before submitting another image.",
)

# Rate limiter for password reset requests (5 requests per 5 minutes per IP/email)
password_reset_rate_limiter = InMemorySlidingWindowRateLimiter(
    max_requests=5,
    window_seconds=300,
    detail_message="Too many password reset requests. Please wait a few minutes before trying again.",
)


def get_client_ip(request: Request) -> str:
    """Extract client IP, taking X-Forwarded-For into account safely."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Use first address in X-Forwarded-For chain
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"
