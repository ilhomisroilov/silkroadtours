"""Public catalogue: destinations, tours with filters, tour detail with dated departures, and a price quote.
Everything a visitor needs to decide, priced by the server."""

import uuid
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Text, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.i18n import pick, pick_list
from app.core.money import apply_percent
from app.db import get_session
from app.models import Departure, Destination, Tour, TourDay
from app.services.booking import BookingError, check_bookable, make_quote

router = APIRouter(prefix="/v1", tags=["catalogue"])
Locale = Literal["uz", "ru", "en"]


def destination_card(d: Destination, locale: str) -> dict:
    return {"slug": d.slug, "name": pick(d.i18n, locale, "name", d.slug), "tagline": pick(d.i18n, locale, "tagline"),
            "country": d.country, "hero_image": d.hero_image, "best_months": d.best_months, "lat": d.lat, "lng": d.lng}


def _published_tours():
    return select(Tour).where(Tour.is_active.is_(True), Tour.archived_at.is_(None))


def _open_departures(today: date):
    return and_(Departure.status == "open", Departure.start_date > today,
                Departure.seats_reserved < Departure.seats_total)


@router.get("/destinations")
async def destinations(locale: Locale = "en", session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(select(Destination).where(Destination.is_published.is_(True))
                                  .order_by(Destination.sort_order, Destination.slug))).all()
    return [destination_card(d, locale) for d in rows]


@router.get("/destinations/{slug}")
async def destination(slug: str, locale: Locale = "en", session: AsyncSession = Depends(get_session)):
    d = await session.scalar(select(Destination).where(Destination.slug == slug, Destination.is_published.is_(True)))
    if d is None:
        raise HTTPException(404, {"code": "not_found"})
    return destination_card(d, locale) | {"overview": pick(d.i18n, locale, "overview"),
                                          "best_time": pick(d.i18n, locale, "best_time")}


@router.get("/tours")
async def tours(
    locale: Locale = "en",
    destination: str | None = None,
    audience: Literal["inbound", "domestic", "outbound"] | None = None,
    category: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    min_days: int | None = Query(None, ge=1, le=60),
    max_days: int | None = Query(None, ge=1, le=60),
    max_price_minor: int | None = Query(None, ge=0),
    q: str | None = Query(None, max_length=100),
    sort: Literal["recommended", "price", "duration", "soonest"] = "recommended",
    page: int = Query(1, ge=1, le=100),
    per_page: int = Query(12, ge=1, le=48),
    session: AsyncSession = Depends(get_session),
):
    today = date.today()
    next_dep = (select(Departure.tour_id, func.min(Departure.start_date).label("next_date"))
                .where(_open_departures(today)).group_by(Departure.tour_id).subquery())
    stmt = _published_tours().add_columns(next_dep.c.next_date).outerjoin(next_dep, next_dep.c.tour_id == Tour.id)
    if destination:
        stmt = stmt.join(Destination, Destination.id == Tour.destination_id).where(Destination.slug == destination)
    if audience:
        stmt = stmt.where(Tour.audience == audience)
    if category:
        stmt = stmt.where(Tour.category == category)
    if month:
        stmt = stmt.where(or_(func.jsonb_array_length(Tour.season_months) == 0, Tour.season_months.contains([month])))
    if min_days:
        stmt = stmt.where(Tour.duration_days >= min_days)
    if max_days:
        stmt = stmt.where(Tour.duration_days <= max_days)
    if max_price_minor is not None:
        stmt = stmt.where(Tour.adult_price_minor <= max_price_minor)
    if q:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        stmt = stmt.where(or_(Tour.title.ilike(like), cast(Tour.i18n, Text).ilike(like)))
    order = {
        "recommended": (Tour.sort_order, Tour.slug),
        "price": (Tour.adult_price_minor, Tour.slug),
        "duration": (Tour.duration_days, Tour.slug),
        "soonest": (next_dep.c.next_date.asc().nulls_last(), Tour.slug),
    }[sort]
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await session.execute(stmt.order_by(*order).offset((page - 1) * per_page).limit(per_page))).all()
    return {
        "total": total, "page": page, "per_page": per_page,
        "items": [tour_card(t, locale, next_date) for t, next_date in rows],
    }


def tour_card(t: Tour, locale: str, next_date: date | None) -> dict:
    return {
        "slug": t.slug, "title": pick(t.i18n, locale, "title", t.title), "summary": pick(t.i18n, locale, "summary"),
        "audience": t.audience, "category": t.category, "duration_days": t.duration_days,
        "from_price": {"currency": t.currency, "amount_minor": t.adult_price_minor},
        "compare_at_price": ({"currency": t.currency, "amount_minor": t.compare_at_price_minor}
                             if t.compare_at_price_minor else None),
        "free_cancel_days": t.free_cancel_days, "hero_image": t.hero_image,
        "next_departure": next_date.isoformat() if next_date else None,
    }


@router.get("/tours/{slug}")
async def tour(slug: str, locale: Locale = "en", session: AsyncSession = Depends(get_session)):
    t = await session.scalar(_published_tours().where(Tour.slug == slug))
    if t is None:
        raise HTTPException(404, {"code": "not_found"})
    today = date.today()
    deps = (await session.scalars(select(Departure).where(
        Departure.tour_id == t.id, Departure.status == "open", Departure.start_date > today,
        Departure.start_date <= today + timedelta(days=550)).order_by(Departure.start_date))).all()
    days = (await session.scalars(select(TourDay).where(TourDay.tour_id == t.id).order_by(TourDay.day_no))).all()
    dest = await session.get(Destination, t.destination_id) if t.destination_id else None
    return tour_card(t, locale, deps[0].start_date if deps else None) | {
        "description": pick(t.i18n, locale, "description"),
        "included": pick_list(t.i18n, locale, "included"),
        "excluded": pick_list(t.i18n, locale, "excluded"),
        "gallery": t.gallery, "min_group": t.min_group, "max_group": t.max_group,
        "deposit_percent": t.deposit_percent,
        "destination": destination_card(dest, locale) if dest and dest.is_published else None,
        "itinerary": [{"day": d.day_no, "title": pick(d.i18n, locale, "title"), "body": pick(d.i18n, locale, "body"),
                       "overnight": d.overnight} for d in days],
        "departures": [{
            "id": str(d.id), "start_date": d.start_date.isoformat(), "end_date": d.end_date.isoformat(),
            "seats_left": d.seats_left, "sold_out": d.seats_left <= 0,
            "price": {"currency": t.currency, "amount_minor": apply_percent(t.adult_price_minor, d.price_modifier_percent)},
        } for d in deps],
    }


class QuoteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    departure_id: uuid.UUID
    adults: int = Field(ge=1, le=30)
    children: int = Field(0, ge=0, le=29)


@router.post("/quote")
async def quote(body: QuoteIn, session: AsyncSession = Depends(get_session)):
    """The exact price the booking will have, before the traveller commits."""
    dep = await session.get(Departure, body.departure_id)
    if dep is None:
        raise HTTPException(404, {"code": "departure_not_found"})
    tour = await session.get(Tour, dep.tour_id)
    try:
        check_bookable(tour, dep, body.adults + body.children)
    except BookingError as e:
        raise HTTPException(e.status, {"code": e.code, "message": e.message}) from None
    qt = make_quote(tour, dep, body.adults, body.children)
    m = lambda v: {"currency": qt.currency, "amount_minor": v}  # noqa: E731
    return {"total": m(qt.total_minor), "deposit": m(qt.deposit_minor), "balance": m(qt.total_minor - qt.deposit_minor),
            "per_adult": m(qt.per_adult_minor), "per_child": m(qt.per_child_minor),
            "free_cancel_until": qt.free_cancel_until.isoformat() if qt.free_cancel_until else None,
            "seats_left": qt.seats_left}
