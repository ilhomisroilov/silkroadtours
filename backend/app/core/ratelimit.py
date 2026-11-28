"""Fixed-window rate limits in Redis, keyed by client IP. If Redis is down the request is allowed and the
failure is logged: a booking must never be lost because a limiter is unavailable."""

import logging

from fastapi import HTTPException, Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import get_settings

log = logging.getLogger("nt.ratelimit")
_redis: Redis | None = None


def redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, socket_timeout=0.3, socket_connect_timeout=0.3)
    return _redis


def client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers and trusts only the local nginx, so this is the real client address
    return request.client.host if request.client else "unknown"


def limit(name: str, times: int, seconds: int):
    async def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        key = f"rl:{name}:{client_ip(request)}"
        try:
            pipe = redis().pipeline()
            pipe.incr(key)
            pipe.expire(key, seconds, nx=True)
            count, _ = await pipe.execute()
        except RedisError as exc:
            log.warning("rate limiter unavailable: %s", exc)
            return
        if count > times:
            raise HTTPException(status_code=429, detail={"code": "too_many_requests"},
                                headers={"Retry-After": str(seconds)})

    return dependency
