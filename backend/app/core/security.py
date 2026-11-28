from fastapi import HTTPException, Request

from app.config import get_settings


def same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer", "")
        origin = "/".join(referer.split("/")[:3]) if referer else None
    if origin not in get_settings().allowed_origins:
        raise HTTPException(403, {"code": "bad_origin"})
