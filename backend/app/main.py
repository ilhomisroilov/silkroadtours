import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import admin, auth, bookings, catalog, payments, requests
from app.config import get_settings
from app.db import SessionLocal
from app.services.booking import BookingError

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store",
}


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title=f"{s.brand_name} API",
        version="0.1.0",
        docs_url="/docs" if s.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if s.docs_enabled else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Idempotency-Key", "X-Booking-Token", "Authorization"],
        allow_credentials=True,
        max_age=600,
    )

    @app.middleware("http")
    async def headers(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        response.headers["X-Request-ID"] = request_id[:64]
        return response

    @app.exception_handler(BookingError)
    async def booking_error(_: Request, exc: BookingError):
        return JSONResponse({"detail": {"code": exc.code, "message": exc.message}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = [".".join(str(p) for p in e["loc"][1:]) for e in exc.errors()]
        return JSONResponse({"detail": {"code": "invalid_input", "fields": fields}}, status_code=422)

    @app.get("/health", include_in_schema=False)
    async def health():
        return {"status": "ok"}

    @app.get("/ready", include_in_schema=False)
    async def ready():
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready"}

    app.include_router(auth.router)
    app.include_router(bookings.router)
    app.include_router(payments.router)
    app.include_router(catalog.router)
    app.include_router(requests.router)
    app.include_router(admin.router)
    return app


app = create_app()
