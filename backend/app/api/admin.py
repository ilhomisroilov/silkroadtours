"""Staff API for the admin panel. Every call needs a staff session that passed the second factor and the
permission for that action; every change is written to the audit log with who, what and from where."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import current
from app.config import get_settings
from app.core.permissions import STAFF_ROLES, can
from app.core.ratelimit import client_ip
from app.core.security import same_origin
from app.db import get_session
from app.models import (
    AuditLog,
    Booking,
    BookingStatusChange,
    Departure,
    Destination,
    Note,
    Payment,
    ServiceRequest,
    Tour,
    TourDay,
    User,
)
from app.services import accounts
from app.services.booking import (
    BookingError,
    apply_payment,
    create_custom_booking,
    lock_booking,
    reverse_payment,
    transition,
)

router = APIRouter(prefix="/v1/admin", tags=["admin"])


class Staff:
    def __init__(self, user: User, request: Request):
        self.user = user
        self.actor = f"admin:{user.id}"
        self.ip = client_ip(request)


def staff(permission: str):
    async def dependency(request: Request, found=Depends(current)) -> Staff:
        sess, user = found
        if user.role not in STAFF_ROLES:
            raise HTTPException(403, {"code": "forbidden"})
        if not sess.mfa_verified:
            raise HTTPException(403, {"code": "mfa_required"})
        if not can(user.role, permission):
            raise HTTPException(403, {"code": "forbidden", "permission": permission})
        if request.method not in ("GET", "HEAD"):
            same_origin(request)
        return Staff(user, request)

    return dependency


def audit(session: AsyncSession, who: Staff, action: str, entity: str, entity_id, data: dict | None = None) -> None:
    session.add(AuditLog(actor=who.actor, action=action, entity=entity, entity_id=str(entity_id), data=data or {},
                         ip=who.ip))


def booking_error(e: BookingError) -> HTTPException:
    return HTTPException(e.status, {"code": e.code, "message": e.message})


# ── dashboard ───────────────────────────────────────────────────────────────

@router.get("/stats")
async def stats(who: Staff = Depends(staff("dashboard.view")), session: AsyncSession = Depends(get_session)):
    since = datetime.now(UTC) - timedelta(days=30)
    by_status = dict((await session.execute(select(Booking.status, func.count()).group_by(Booking.status))).all())
    revenue = (await session.execute(
        select(Booking.currency, func.sum(Booking.paid_minor)).where(Booking.created_at >= since)
        .group_by(Booking.currency))).all()
    open_requests = await session.scalar(select(func.count()).select_from(ServiceRequest)
                                         .where(ServiceRequest.status.in_(("new", "in_progress"))))
    unanswered = await session.scalar(select(func.count()).select_from(ServiceRequest)
                                      .where(ServiceRequest.status == "new", ServiceRequest.first_response_at.is_(None)))
    today = date.today()
    upcoming = await session.scalar(
        select(func.count()).select_from(Booking).join(Departure, Departure.id == Booking.departure_id)
        .where(Booking.status == "confirmed", Departure.start_date.between(today, today + timedelta(days=14))))
    refunds_due = (await session.execute(
        select(Booking.currency, func.sum(Booking.refund_due_minor)).where(Booking.refund_due_minor > 0)
        .group_by(Booking.currency))).all()
    return {
        "bookings_by_status": by_status,
        "paid_last_30_days": [{"currency": c, "amount_minor": int(a or 0)} for c, a in revenue],
        "open_requests": open_requests, "unanswered_requests": unanswered,
        "trips_next_14_days": upcoming,
        "refunds_due": [{"currency": c, "amount_minor": int(a or 0)} for c, a in refunds_due],
    }


# ── bookings ────────────────────────────────────────────────────────────────

def booking_row(b: Booking) -> dict:
    return {"id": str(b.id), "reference": b.reference, "kind": b.kind, "status": b.status,
            "payment_state": b.payment_state, "title": b.tour_title_snapshot, "full_name": b.full_name,
            "email": b.email, "phone": b.phone, "adults": b.adults, "children": b.children, "currency": b.currency,
            "total_minor": b.total_minor, "paid_minor": b.paid_minor, "refund_due_minor": b.refund_due_minor,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "hold_expires_at": b.hold_expires_at.isoformat() if b.hold_expires_at else None}


@router.get("/bookings")
async def bookings(
    status: str | None = None,
    payment_state: str | None = None,
    q: str | None = Query(None, max_length=100),
    created_from: date | None = None,
    created_to: date | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    who: Staff = Depends(staff("booking.view")),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Booking)
    if status:
        stmt = stmt.where(Booking.status == status)
    if payment_state:
        stmt = stmt.where(Booking.payment_state == payment_state)
    if q:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        stmt = stmt.where(or_(Booking.reference.ilike(like), Booking.email.ilike(like), Booking.full_name.ilike(like),
                              Booking.phone.ilike(like)))
    if created_from:
        stmt = stmt.where(Booking.created_at >= created_from)
    if created_to:
        stmt = stmt.where(Booking.created_at < created_to + timedelta(days=1))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await session.scalars(stmt.order_by(Booking.created_at.desc())
                                  .offset((page - 1) * per_page).limit(per_page))).all()
    return {"total": total, "items": [booking_row(b) for b in rows]}


async def _booking(session: AsyncSession, reference: str, lock: bool = False) -> Booking:
    b = await session.scalar(select(Booking).where(Booking.reference == reference.upper()))
    if b is None:
        raise HTTPException(404, {"code": "not_found"})
    return await lock_booking(session, b.id) if lock else b


@router.get("/bookings/{reference}")
async def booking_detail(reference: str, who: Staff = Depends(staff("booking.view")),
                         session: AsyncSession = Depends(get_session)):
    b = await _booking(session, reference)
    history = (await session.scalars(select(BookingStatusChange).where(BookingStatusChange.booking_id == b.id)
                                     .order_by(BookingStatusChange.created_at))).all()
    payments = (await session.scalars(select(Payment).where(Payment.booking_id == b.id)
                                      .order_by(Payment.created_at))).all()
    notes = (await session.scalars(select(Note).where(Note.entity == "booking", Note.entity_id == b.id)
                                   .order_by(Note.created_at))).all()
    dep = await session.get(Departure, b.departure_id) if b.departure_id else None
    return booking_row(b) | {
        "special_requests": b.special_requests, "locale": b.locale, "deposit_minor": b.deposit_minor,
        "free_cancel_until": b.free_cancel_until.isoformat() if b.free_cancel_until else None,
        "start_date": dep.start_date.isoformat() if dep else None,
        "history": [{"from": h.from_status, "to": h.to_status, "actor": h.actor, "reason": h.reason,
                     "at": h.created_at.isoformat()} for h in history],
        "payments": [{"order_no": p.order_no, "provider": p.provider, "method": p.method, "status": p.status,
                      "amount_minor": p.amount_minor, "currency": p.currency,
                      "booking_amount_minor": p.booking_amount_minor, "reference": p.external_reference,
                      "paid_at": p.paid_at.isoformat() if p.paid_at else None} for p in payments],
        "notes": [{"text": n.text, "author_id": str(n.author_id) if n.author_id else None,
                   "at": n.created_at.isoformat()} for n in notes],
    }


class StatusIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    to: Literal["confirmed", "completed", "cancelled"]
    reason: str = Field(min_length=3, max_length=500)


@router.post("/bookings/{reference}/status")
async def booking_status(reference: str, body: StatusIn, who: Staff = Depends(staff("booking.update")),
                         session: AsyncSession = Depends(get_session)):
    b = await _booking(session, reference, lock=True)
    before = b.status
    try:
        await transition(session, b, body.to, who.actor, body.reason)
    except BookingError as e:
        raise booking_error(e) from None
    if body.to == "cancelled" and b.paid_minor > 0:
        b.refund_due_minor = b.paid_minor
    audit(session, who, "booking.status", "booking", b.reference, {"from": before, "to": body.to, "reason": body.reason})
    await session.commit()
    return booking_row(b)


class NoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=4000)


@router.post("/bookings/{reference}/notes", status_code=201)
async def booking_note(reference: str, body: NoteIn, who: Staff = Depends(staff("booking.note")),
                       session: AsyncSession = Depends(get_session)):
    b = await _booking(session, reference)
    session.add(Note(entity="booking", entity_id=b.id, author_id=who.user.id, text=body.text))
    audit(session, who, "booking.note", "booking", b.reference)
    await session.commit()
    return {"ok": True}


class ManualPaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_minor: int = Field(gt=0, description="In the booking currency")
    method: Literal["cash", "bank_transfer", "card_terminal"]
    reference: str = Field(min_length=2, max_length=120, description="Receipt or bank transfer number")


@router.post("/bookings/{reference}/payments", status_code=201)
async def record_payment(reference: str, body: ManualPaymentIn, who: Staff = Depends(staff("payment.record")),
                         session: AsyncSession = Depends(get_session)):
    """Money received outside the online checkout (office cash, bank transfer, card terminal)."""
    b = await _booking(session, reference, lock=True)
    if body.amount_minor > b.total_minor - b.paid_minor:
        raise HTTPException(422, {"code": "more_than_due"})
    try:
        await apply_payment(session, b, body.amount_minor, actor=who.actor)
    except BookingError as e:
        raise booking_error(e) from None
    session.add(Payment(booking_id=b.id, provider="manual", method=body.method, status="succeeded",
                        booking_amount_minor=body.amount_minor, amount_minor=body.amount_minor, currency=b.currency,
                        external_reference=body.reference, recorded_by=who.user.id, paid_at=accounts.now()))
    audit(session, who, "payment.record", "booking", b.reference, body.model_dump())
    await session.commit()
    return booking_row(b)


class RefundIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_minor: int = Field(gt=0)
    reference: str = Field(min_length=2, max_length=120)


@router.post("/bookings/{reference}/refunds", status_code=201)
async def record_refund(reference: str, body: RefundIn, who: Staff = Depends(staff("payment.refund")),
                        session: AsyncSession = Depends(get_session)):
    """Money paid back to the traveller by bank or cash. Online provider refunds are handled by the callbacks."""
    b = await _booking(session, reference, lock=True)
    if body.amount_minor > b.paid_minor:
        raise HTTPException(422, {"code": "more_than_paid"})
    try:
        await reverse_payment(session, b, body.amount_minor, actor=who.actor)
    except BookingError as e:
        raise booking_error(e) from None
    session.add(Payment(booking_id=b.id, provider="manual", method="refund", status="refunded",
                        booking_amount_minor=body.amount_minor, amount_minor=body.amount_minor, currency=b.currency,
                        external_reference=body.reference, recorded_by=who.user.id, paid_at=accounts.now()))
    audit(session, who, "payment.refund", "booking", b.reference, body.model_dump())
    await session.commit()
    return booking_row(b)


# ── service requests ────────────────────────────────────────────────────────

def request_row(r: ServiceRequest) -> dict:
    return {"reference": r.reference, "kind": r.kind, "status": r.status, "full_name": r.full_name, "email": r.email,
            "phone": r.phone, "contact_channel": r.contact_channel, "locale": r.locale,
            "start_date": r.start_date.isoformat() if r.start_date else None,
            "end_date": r.end_date.isoformat() if r.end_date else None, "adults": r.adults, "children": r.children,
            "budget_minor": r.budget_minor, "currency": r.currency, "details": r.details, "message": r.message,
            "assigned_to": str(r.assigned_to) if r.assigned_to else None, "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else None}


@router.get("/requests")
async def requests(status: str | None = None, kind: str | None = None, mine: bool = False,
                   page: int = Query(1, ge=1), per_page: int = Query(25, ge=1, le=100),
                   who: Staff = Depends(staff("request.view")), session: AsyncSession = Depends(get_session)):
    stmt = select(ServiceRequest)
    if status:
        stmt = stmt.where(ServiceRequest.status == status)
    if kind:
        stmt = stmt.where(ServiceRequest.kind == kind)
    if mine:
        stmt = stmt.where(ServiceRequest.assigned_to == who.user.id)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await session.scalars(stmt.order_by(ServiceRequest.created_at.desc())
                                  .offset((page - 1) * per_page).limit(per_page))).all()
    return {"total": total, "items": [request_row(r) for r in rows]}


class RequestUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["new", "in_progress", "quoted", "lost", "cancelled"] | None = None
    assigned_to: uuid.UUID | None = None
    note: str | None = Field(None, max_length=4000)


async def _request(session: AsyncSession, reference: str) -> ServiceRequest:
    r = await session.scalar(select(ServiceRequest).where(ServiceRequest.reference == reference.upper())
                             .with_for_update())
    if r is None:
        raise HTTPException(404, {"code": "not_found"})
    return r


@router.patch("/requests/{reference}")
async def update_request(reference: str, body: RequestUpdateIn, who: Staff = Depends(staff("request.update")),
                         session: AsyncSession = Depends(get_session)):
    r = await _request(session, reference)
    if r.status == "won":
        raise HTTPException(409, {"code": "already_won"})
    changes = body.model_dump(exclude_unset=True, mode="json")
    if body.status:
        r.status = body.status
        if body.status != "new" and r.first_response_at is None:
            r.first_response_at = accounts.now()
    if "assigned_to" in body.model_fields_set:
        if body.assigned_to is not None:
            assignee = await session.get(User, body.assigned_to)
            if assignee is None or assignee.role not in STAFF_ROLES:
                raise HTTPException(422, {"code": "not_staff"})
        r.assigned_to = body.assigned_to
    if body.note:
        session.add(Note(entity="request", entity_id=r.id, author_id=who.user.id, text=body.note))
    audit(session, who, "request.update", "request", r.reference, changes)
    await session.commit()
    return request_row(r)


class ConvertIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=300)
    currency: Literal["USD", "EUR", "UZS", "RUB"]
    total_minor: int = Field(gt=0)
    deposit_percent: int = Field(30, ge=0, le=100)
    hold_hours: int = Field(72, ge=1, le=720)
    free_cancel_until: date | None = None


@router.post("/requests/{reference}/convert", status_code=201)
async def convert_request(reference: str, body: ConvertIn, who: Staff = Depends(staff("request.convert")),
                          session: AsyncSession = Depends(get_session)):
    """The traveller accepted the offer: create a payable booking. Returns a private link to send to them."""
    r = await _request(session, reference)
    if r.booking_id is not None:
        raise HTTPException(409, {"code": "already_converted"})
    try:
        b, token = await create_custom_booking(
            session, title=body.title, currency=body.currency, total_minor=body.total_minor,
            deposit_percent=body.deposit_percent, adults=r.adults, children=r.children, full_name=r.full_name,
            email=r.email, phone=r.phone, locale=r.locale, user_id=r.user_id, actor=who.actor,
            hold_hours=body.hold_hours, free_cancel_until=body.free_cancel_until)
    except BookingError as e:
        raise booking_error(e) from None
    r.booking_id, r.status = b.id, "won"
    r.first_response_at = r.first_response_at or accounts.now()
    audit(session, who, "request.convert", "request", r.reference,
          body.model_dump(mode="json") | {"booking": b.reference})
    await session.commit()

    link = f"{get_settings().site_url}/{b.locale}/booking/{b.reference}?token={token}"
    return {"booking": booking_row(b), "payment_link": link}


# ── catalogue ───────────────────────────────────────────────────────────────

I18n = dict[Literal["uz", "ru", "en"], dict[str, str | list[str]]]


class TourIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    title: str = Field(min_length=3, max_length=300)
    i18n: I18n = Field(default_factory=dict)
    destination_slug: str | None = None
    audience: Literal["inbound", "domestic", "outbound"] = "inbound"
    category: Literal["cultural", "adventure", "gastronomy", "pilgrimage", "nature", "city", "family", "luxury",
                      "other"] = "cultural"
    duration_days: int = Field(ge=1, le=60)
    min_group: int = Field(1, ge=1, le=100)
    max_group: int = Field(16, ge=1, le=100)
    currency: Literal["USD", "EUR", "UZS", "RUB"] = "USD"
    adult_price_minor: int = Field(ge=0)
    child_price_minor: int | None = Field(None, ge=0)
    compare_at_price_minor: int | None = Field(None, ge=0)
    free_cancel_days: int = Field(30, ge=0, le=365)
    deposit_percent: int | None = Field(None, ge=0, le=100)
    hero_image: str | None = Field(None, max_length=500)
    gallery: list[str] = Field(default_factory=list, max_length=40)
    season_months: list[int] = Field(default_factory=list, max_length=12)
    sort_order: int = 0
    is_active: bool = False


class TourPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(None, min_length=3, max_length=300)
    i18n: I18n | None = None
    destination_slug: str | None = None
    audience: Literal["inbound", "domestic", "outbound"] | None = None
    category: Literal["cultural", "adventure", "gastronomy", "pilgrimage", "nature", "city", "family", "luxury",
                      "other"] | None = None
    duration_days: int | None = Field(None, ge=1, le=60)
    min_group: int | None = Field(None, ge=1, le=100)
    max_group: int | None = Field(None, ge=1, le=100)
    adult_price_minor: int | None = Field(None, ge=0)
    child_price_minor: int | None = Field(None, ge=0)
    compare_at_price_minor: int | None = Field(None, ge=0)
    free_cancel_days: int | None = Field(None, ge=0, le=365)
    deposit_percent: int | None = Field(None, ge=0, le=100)
    hero_image: str | None = Field(None, max_length=500)
    gallery: list[str] | None = Field(None, max_length=40)
    season_months: list[int] | None = Field(None, max_length=12)
    sort_order: int | None = None
    is_active: bool | None = None


PRICE_FIELDS = {"adult_price_minor", "child_price_minor", "compare_at_price_minor", "deposit_percent", "free_cancel_days"}


async def _destination_id(session: AsyncSession, slug: str | None) -> uuid.UUID | None:
    if slug is None:
        return None
    d = await session.scalar(select(Destination).where(Destination.slug == slug))
    if d is None:
        raise HTTPException(422, {"code": "unknown_destination"})
    return d.id


def _check_tour(t: Tour) -> None:
    """The rules the database also enforces, checked first so staff get a clear message instead of an error."""
    if t.max_group < t.min_group:
        raise HTTPException(422, {"code": "group_range"})
    if t.compare_at_price_minor is not None and t.compare_at_price_minor <= t.adult_price_minor:
        raise HTTPException(422, {"code": "compare_price_not_higher"})


def tour_row(t: Tour) -> dict:
    return {"id": str(t.id), "slug": t.slug, "title": t.title, "i18n": t.i18n, "audience": t.audience,
            "category": t.category, "duration_days": t.duration_days, "currency": t.currency,
            "adult_price_minor": t.adult_price_minor, "child_price_minor": t.child_price_minor,
            "compare_at_price_minor": t.compare_at_price_minor, "free_cancel_days": t.free_cancel_days,
            "deposit_percent": t.deposit_percent, "is_active": t.is_active, "sort_order": t.sort_order,
            "min_group": t.min_group, "max_group": t.max_group, "hero_image": t.hero_image, "gallery": t.gallery,
            "season_months": t.season_months, "archived": t.archived_at is not None}


@router.get("/tours")
async def admin_tours(who: Staff = Depends(staff("catalog.view")), session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(select(Tour).order_by(Tour.sort_order, Tour.slug))).all()
    return [tour_row(t) for t in rows]


@router.post("/tours", status_code=201)
async def create_tour(body: TourIn, who: Staff = Depends(staff("catalog.edit")),
                      session: AsyncSession = Depends(get_session)):
    if not can(who.user.role, "catalog.price"):
        raise HTTPException(403, {"code": "forbidden", "permission": "catalog.price"})
    if await session.scalar(select(Tour.id).where(Tour.slug == body.slug)):
        raise HTTPException(409, {"code": "slug_taken"})
    data = body.model_dump(exclude={"destination_slug"})
    t = Tour(**data, destination_id=await _destination_id(session, body.destination_slug))
    _check_tour(t)
    session.add(t)
    await session.flush()
    audit(session, who, "tour.create", "tour", t.slug, body.model_dump(mode="json"))
    await session.commit()
    return tour_row(t)


@router.patch("/tours/{slug}")
async def update_tour(slug: str, body: TourPatch, who: Staff = Depends(staff("catalog.edit")),
                      session: AsyncSession = Depends(get_session)):
    t = await session.scalar(select(Tour).where(Tour.slug == slug).with_for_update())
    if t is None:
        raise HTTPException(404, {"code": "not_found"})
    changes = body.model_dump(exclude_unset=True)
    if PRICE_FIELDS & changes.keys() and not can(who.user.role, "catalog.price"):
        raise HTTPException(403, {"code": "forbidden", "permission": "catalog.price"})
    if "destination_slug" in changes:
        t.destination_id = await _destination_id(session, changes.pop("destination_slug"))
    before = {k: getattr(t, k) for k in changes}
    for k, v in changes.items():
        setattr(t, k, v)
    _check_tour(t)
    audit(session, who, "tour.update", "tour", t.slug, {"before": before, "after": changes})
    await session.commit()
    return tour_row(t)


class DayIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    i18n: I18n
    overnight: str | None = Field(None, max_length=120)


@router.put("/tours/{slug}/itinerary")
async def put_itinerary(slug: str, days: list[DayIn], who: Staff = Depends(staff("catalog.edit")),
                        session: AsyncSession = Depends(get_session)):
    t = await session.scalar(select(Tour).where(Tour.slug == slug).with_for_update())
    if t is None:
        raise HTTPException(404, {"code": "not_found"})
    if len(days) > t.duration_days:
        raise HTTPException(422, {"code": "more_days_than_tour"})
    for old in (await session.scalars(select(TourDay).where(TourDay.tour_id == t.id))).all():
        await session.delete(old)
    await session.flush()
    for i, d in enumerate(days, start=1):
        session.add(TourDay(tour_id=t.id, day_no=i, i18n=d.i18n, overnight=d.overnight))
    audit(session, who, "tour.itinerary", "tour", t.slug, {"days": len(days)})
    await session.commit()
    return {"days": len(days)}


class DepartureIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_date: date
    seats_total: int = Field(ge=1, le=500)
    price_modifier_percent: int = Field(0, ge=-90, le=300)


@router.post("/tours/{slug}/departures", status_code=201)
async def add_departure(slug: str, body: DepartureIn, who: Staff = Depends(staff("catalog.edit")),
                        session: AsyncSession = Depends(get_session)):
    t = await session.scalar(select(Tour).where(Tour.slug == slug))
    if t is None:
        raise HTTPException(404, {"code": "not_found"})
    if body.start_date <= date.today():
        raise HTTPException(422, {"code": "date_in_past"})
    if body.price_modifier_percent and not can(who.user.role, "catalog.price"):
        raise HTTPException(403, {"code": "forbidden", "permission": "catalog.price"})
    if await session.scalar(select(Departure.id).where(Departure.tour_id == t.id,
                                                       Departure.start_date == body.start_date)):
        raise HTTPException(409, {"code": "departure_exists"})
    d = Departure(tour_id=t.id, start_date=body.start_date,
                  end_date=body.start_date + timedelta(days=t.duration_days - 1), seats_total=body.seats_total,
                  price_modifier_percent=body.price_modifier_percent)
    session.add(d)
    await session.flush()
    audit(session, who, "departure.create", "departure", d.id, body.model_dump(mode="json") | {"tour": t.slug})
    await session.commit()
    return {"id": str(d.id), "start_date": d.start_date.isoformat(), "end_date": d.end_date.isoformat(),
            "seats_total": d.seats_total}


class DeparturePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seats_total: int | None = Field(None, ge=1, le=500)
    status: Literal["open", "closed", "cancelled"] | None = None
    price_modifier_percent: int | None = Field(None, ge=-90, le=300)


@router.patch("/departures/{departure_id}")
async def update_departure(departure_id: uuid.UUID, body: DeparturePatch, who: Staff = Depends(staff("catalog.edit")),
                           session: AsyncSession = Depends(get_session)):
    d = await session.scalar(select(Departure).where(Departure.id == departure_id).with_for_update())
    if d is None:
        raise HTTPException(404, {"code": "not_found"})
    if body.seats_total is not None and body.seats_total < d.seats_reserved:
        raise HTTPException(409, {"code": "below_reserved", "reserved": d.seats_reserved})
    if body.price_modifier_percent is not None and not can(who.user.role, "catalog.price"):
        raise HTTPException(403, {"code": "forbidden", "permission": "catalog.price"})
    if body.status == "cancelled" and d.seats_reserved > 0:
        # Travellers are moved or refunded by a manager first; the system never strands paid bookings.
        raise HTTPException(409, {"code": "has_bookings", "reserved": d.seats_reserved})
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(d, k, v)
    audit(session, who, "departure.update", "departure", d.id, changes)
    await session.commit()
    return {"id": str(d.id), "seats_total": d.seats_total, "seats_reserved": d.seats_reserved, "status": d.status}


class DestinationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=160)
    i18n: I18n
    country: str = Field("UZ", min_length=2, max_length=2)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    hero_image: str | None = Field(None, max_length=500)
    best_months: list[int] = Field(default_factory=list, max_length=12)
    sort_order: int = 0
    is_published: bool = False


@router.put("/destinations/{slug}")
async def put_destination(slug: str, body: DestinationIn, who: Staff = Depends(staff("catalog.edit")),
                          session: AsyncSession = Depends(get_session)):
    if body.slug != slug:
        raise HTTPException(422, {"code": "slug_mismatch"})
    d = await session.scalar(select(Destination).where(Destination.slug == slug))
    if d is None:
        d = Destination(**body.model_dump())
        session.add(d)
    else:
        for k, v in body.model_dump().items():
            setattr(d, k, v)
    audit(session, who, "destination.put", "destination", slug)
    await session.commit()
    return {"slug": d.slug, "is_published": d.is_published}


# ── staff and audit ─────────────────────────────────────────────────────────

class RoleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254)
    role: Literal["tourist", "manager", "editor", "finance", "admin"]


@router.post("/staff/role")
async def set_role(body: RoleIn, who: Staff = Depends(staff("staff.manage")), session: AsyncSession = Depends(get_session)):
    """Owner gives or takes a staff role. The owner role itself is only set from the server command line."""
    user = await session.scalar(select(User).where(User.email == accounts.normalise_email(body.email)))
    if user is None:
        raise HTTPException(404, {"code": "not_found"})
    if user.role == "owner":
        raise HTTPException(409, {"code": "cannot_change_owner"})
    before = user.role
    user.role = body.role
    await accounts.revoke_all_sessions(session, user.id)  # new rights take effect on next sign-in
    audit(session, who, "staff.role", "user", user.id, {"from": before, "to": body.role, "email": user.email})
    await session.commit()
    return {"email": user.email, "role": user.role}


@router.get("/audit")
async def audit_log(entity: str | None = None, entity_id: str | None = None, page: int = Query(1, ge=1),
                    who: Staff = Depends(staff("audit.view")), session: AsyncSession = Depends(get_session)):
    stmt = select(AuditLog)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    rows = (await session.scalars(stmt.order_by(AuditLog.id.desc()).offset((page - 1) * 50).limit(50))).all()
    return [{"actor": a.actor, "action": a.action, "entity": a.entity, "entity_id": a.entity_id, "data": a.data,
             "ip": a.ip, "at": a.created_at.isoformat()} for a in rows]
