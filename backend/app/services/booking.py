"""Booking rules. Every seat change happens under a row lock on the departure, so two travellers can never
buy the same last seat, and every status change is checked against the allowed transitions and logged."""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.money import apply_percent, share
from app.core.tokens import booking_reference, hash_token, new_access_token
from app.models import Booking, BookingStatusChange, Departure, Payment, ProviderTransaction, Tour

ALLOWED: dict[str, set[str]] = {
    "awaiting_payment": {"confirmed", "cancelled", "expired"},
    "confirmed": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "expired": {"confirmed"},  # only when a late payment arrives and the seats are still free
}
HOLDS_SEATS = {"awaiting_payment", "confirmed", "completed"}
MAX_SEATS_PER_BOOKING = 30


class BookingError(Exception):
    def __init__(self, code: str, message: str, status: int = 409):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass
class NewBooking:
    departure_id: uuid.UUID
    adults: int
    children: int
    full_name: str
    email: str
    phone: str
    locale: str = "en"
    special_requests: str | None = None


def now() -> datetime:
    return datetime.now(UTC)


def price_total(tour: Tour, departure: Departure, adults: int, children: int) -> int:
    child = tour.child_price_minor if tour.child_price_minor is not None else tour.adult_price_minor
    base = adults * tour.adult_price_minor + children * child
    return apply_percent(base, departure.price_modifier_percent)


async def _locked_departure(session: AsyncSession, departure_id: uuid.UUID) -> Departure:
    dep = await session.scalar(select(Departure).where(Departure.id == departure_id).with_for_update())
    if dep is None:
        raise BookingError("departure_not_found", "Departure not found", 404)
    return dep


@dataclass
class Quote:
    currency: str
    total_minor: int
    deposit_minor: int
    per_adult_minor: int
    per_child_minor: int
    free_cancel_until: date | None
    seats_left: int


def deposit_for(total: int, tour: Tour | None) -> int:
    pct = tour.deposit_percent if tour is not None and tour.deposit_percent is not None else get_settings().deposit_percent
    return share(total, pct) or total


def make_quote(tour: Tour, dep: Departure, adults: int, children: int) -> Quote:
    total = price_total(tour, dep, adults, children)
    child = tour.child_price_minor if tour.child_price_minor is not None else tour.adult_price_minor
    free_until = dep.start_date - timedelta(days=tour.free_cancel_days) if tour.free_cancel_days else None
    return Quote(currency=tour.currency, total_minor=total, deposit_minor=deposit_for(total, tour),
                 per_adult_minor=apply_percent(tour.adult_price_minor, dep.price_modifier_percent),
                 per_child_minor=apply_percent(child, dep.price_modifier_percent),
                 free_cancel_until=free_until if free_until and free_until >= now().date() else None,
                 seats_left=dep.seats_left)


def check_bookable(tour: Tour | None, dep: Departure, seats: int, today: date | None = None) -> None:
    if tour is None or not tour.is_active or tour.archived_at is not None or dep.status != "open":
        raise BookingError("departure_closed", "This departure is not open for booking")
    if dep.start_date <= (today or now().date()):
        raise BookingError("departure_past", "This departure has already started")
    if seats > tour.max_group:
        raise BookingError("group_too_large", f"At most {tour.max_group} travellers per booking", 422)
    if dep.seats_left < seats:
        raise BookingError("not_enough_seats", f"Only {dep.seats_left} seats left")


async def create_booking(session: AsyncSession, data: NewBooking, today: date | None = None) -> tuple[Booking, str]:
    """Reserve seats and create a booking that waits for payment. Returns the booking and its access token
    (shown to the traveller once; only its hash is stored)."""
    seats = data.adults + data.children
    if data.adults < 1 or data.children < 0 or seats > MAX_SEATS_PER_BOOKING:
        raise BookingError("invalid_party", "Party size is not allowed", 422)

    dep = await _locked_departure(session, data.departure_id)
    tour = await session.get(Tour, dep.tour_id)
    check_bookable(tour, dep, seats, today)
    q = make_quote(tour, dep, data.adults, data.children)

    dep.seats_reserved += seats
    token = new_access_token()
    booking = Booking(
        reference=booking_reference(get_settings().booking_prefix),
        access_token_hash=hash_token(token),
        kind="tour",
        status="awaiting_payment",
        payment_state="unpaid",
        hold_expires_at=now() + timedelta(minutes=get_settings().booking_hold_minutes),
        tour_id=tour.id,
        departure_id=dep.id,
        tour_title_snapshot=(tour.i18n.get(data.locale) or {}).get("title") or tour.title,
        free_cancel_until=q.free_cancel_until,
        adults=data.adults,
        children=data.children,
        seats=seats,
        full_name=data.full_name.strip(),
        email=data.email.strip().lower(),
        phone=data.phone.strip(),
        locale=data.locale,
        special_requests=data.special_requests,
        currency=q.currency,
        total_minor=q.total_minor,
        deposit_minor=q.deposit_minor,
        paid_minor=0,
    )
    session.add(booking)
    await session.flush()
    session.add(BookingStatusChange(booking_id=booking.id, from_status=None, to_status=booking.status,
                                    actor="traveller", reason="created"))
    return booking, token


async def create_custom_booking(session: AsyncSession, *, title: str, currency: str, total_minor: int,
                                deposit_percent: int, adults: int, children: int, full_name: str, email: str,
                                phone: str, locale: str, user_id: uuid.UUID | None, actor: str,
                                hold_hours: int = 72, free_cancel_until: date | None = None) -> tuple[Booking, str]:
    """A booking priced by a manager (hotel, transfer, tailor-made trip). No seats are involved."""
    if total_minor <= 0:
        raise BookingError("invalid_amount", "Total must be positive", 422)
    token = new_access_token()
    booking = Booking(
        reference=booking_reference(get_settings().booking_prefix), access_token_hash=hash_token(token), kind="custom",
        status="awaiting_payment", payment_state="unpaid", hold_expires_at=now() + timedelta(hours=hold_hours),
        tour_title_snapshot=title, free_cancel_until=free_cancel_until, adults=adults, children=children,
        seats=adults + children, full_name=full_name, email=email.strip().lower(), phone=phone, locale=locale,
        currency=currency, total_minor=total_minor, deposit_minor=share(total_minor, deposit_percent) or total_minor,
        paid_minor=0, user_id=user_id,
    )
    session.add(booking)
    await session.flush()
    session.add(BookingStatusChange(booking_id=booking.id, from_status=None, to_status=booking.status, actor=actor,
                                    reason="offer accepted"))
    return booking, token


async def traveller_cancel(session: AsyncSession, booking: Booking, today: date | None = None) -> None:
    """The traveller cancels. Unpaid: always. Paid: free until free_cancel_until, after that a manager decides.
    Money already paid is recorded as owed back; staff pay it out and record the refund."""
    today = today or now().date()
    if booking.status == "awaiting_payment" and booking.paid_minor == 0:
        await transition(session, booking, "cancelled", "traveller", "cancelled before payment")
        return
    if booking.status != "confirmed" and booking.status != "awaiting_payment":
        raise BookingError("not_cancellable", "This booking can no longer be cancelled online")
    if booking.free_cancel_until is None or today > booking.free_cancel_until:
        raise BookingError("cancel_needs_manager", "Free cancellation has ended; please contact us")
    booking.refund_due_minor = booking.paid_minor
    await transition(session, booking, "cancelled", "traveller", "free cancellation")


async def lock_booking(session: AsyncSession, booking_id: uuid.UUID) -> Booking:
    b = await session.scalar(select(Booking).where(Booking.id == booking_id).with_for_update())
    if b is None:
        raise BookingError("booking_not_found", "Booking not found", 404)
    return b


async def transition(session: AsyncSession, booking: Booking, to: str, actor: str, reason: str | None = None) -> None:
    """Change status. The booking row must already be locked by the caller."""
    frm = booking.status
    if to not in ALLOWED.get(frm, set()):
        raise BookingError("bad_transition", f"Cannot change booking from {frm} to {to}")

    if frm in HOLDS_SEATS and to not in HOLDS_SEATS and booking.departure_id:
        dep = await _locked_departure(session, booking.departure_id)
        dep.seats_reserved = max(0, dep.seats_reserved - booking.seats)
    elif frm not in HOLDS_SEATS and to in HOLDS_SEATS and booking.departure_id:
        dep = await _locked_departure(session, booking.departure_id)
        if dep.status != "open" or dep.seats_left < booking.seats:
            raise BookingError("not_enough_seats", "The seats are no longer available")
        dep.seats_reserved += booking.seats

    booking.status = to
    if to != "awaiting_payment":
        booking.hold_expires_at = None
    session.add(BookingStatusChange(booking_id=booking.id, from_status=frm, to_status=to, actor=actor,
                                    reason=reason))


def can_take_payment(booking: Booking) -> bool:
    if booking.amount_due_minor <= 0:
        return False
    if booking.status == "awaiting_payment":
        return booking.hold_expires_at is None or booking.hold_expires_at > now()
    return booking.status == "confirmed"


async def extend_hold(booking: Booking, minutes: int) -> None:
    if booking.status == "awaiting_payment":
        until = now() + timedelta(minutes=minutes)
        if booking.hold_expires_at is None or booking.hold_expires_at < until:
            booking.hold_expires_at = until


async def apply_payment(session: AsyncSession, booking: Booking, amount_minor: int, actor: str) -> None:
    """Credit money to a locked booking and confirm it. Raises BookingError if it cannot be honoured
    (for example the hold expired and the seats were sold); payment providers then cancel the charge."""
    if booking.status in ("cancelled", "completed"):
        raise BookingError("booking_closed", "Booking can no longer be paid")
    if booking.status == "expired":
        await transition(session, booking, "confirmed", actor, "late payment, seats still free")
    booking.paid_minor += amount_minor
    booking.payment_state = "paid" if booking.paid_minor >= booking.total_minor else "deposit_paid"
    if booking.status == "awaiting_payment":
        await transition(session, booking, "confirmed", actor, "payment received")


async def reverse_payment(session: AsyncSession, booking: Booking, amount_minor: int, actor: str) -> None:
    """Undo a credited payment (provider refund). A booking left with no money is cancelled."""
    if booking.status == "completed":
        raise BookingError("booking_completed", "A completed trip cannot be refunded automatically")
    booking.paid_minor = max(0, booking.paid_minor - amount_minor)
    booking.refund_due_minor = max(0, booking.refund_due_minor - amount_minor)
    if booking.paid_minor == 0:
        booking.payment_state = "refunded"
        if booking.status in ("confirmed", "awaiting_payment"):
            await transition(session, booking, "cancelled", actor, "payment refunded")
    else:
        booking.payment_state = "deposit_paid" if booking.paid_minor < booking.total_minor else "paid"


async def expire_holds(session: AsyncSession, limit: int = 200) -> int:
    """Release seats of unpaid bookings whose hold ran out. A booking with a provider transaction still in
    progress keeps its seats until that transaction finishes. Run every minute by the worker."""
    in_progress = (
        select(ProviderTransaction.id)
        .join(Payment, Payment.id == ProviderTransaction.payment_id)
        .where(Payment.booking_id == Booking.id, ProviderTransaction.state == 1)
    )
    rows = (
        await session.scalars(
            select(Booking)
            .where(Booking.status == "awaiting_payment", Booking.paid_minor == 0,
                   Booking.hold_expires_at < now(), ~exists(in_progress))
            .order_by(Booking.hold_expires_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    ).all()
    for b in rows:
        await transition(session, b, "expired", "system", "payment time ran out")
        await session.execute(
            Payment.__table__.update()
            .where(Payment.booking_id == b.id, Payment.status == "pending")
            .values(status="cancelled")
        )
    return len(rows)
