"""Catalogue: destinations, tours with their day-by-day programme, and dated departures with seats.

Texts are stored per language in an `i18n` JSON object: {"uz": {...}, "ru": {...}, "en": {...}}.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, uuid_pk

AUDIENCES = ("inbound", "domestic", "outbound")
CATEGORIES = ("cultural", "adventure", "gastronomy", "pilgrimage", "nature", "city", "family", "luxury", "other")


class Destination(Timestamps, Base):
    __tablename__ = "destinations"

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    i18n: Mapped[dict] = mapped_column(JSONB, default=dict)  # name, tagline, overview, best_time
    country: Mapped[str] = mapped_column(String(2), default="UZ")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    hero_image: Mapped[str | None] = mapped_column(String(500))
    best_months: Mapped[list] = mapped_column(JSONB, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


class Tour(Timestamps, Base):
    __tablename__ = "tours"

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    title: Mapped[str] = mapped_column(String(300))  # internal name; public texts are in i18n
    i18n: Mapped[dict] = mapped_column(JSONB, default=dict)  # title, summary, description, included, excluded
    destination_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("destinations.id", ondelete="SET NULL"),
                                                             index=True)
    audience: Mapped[str] = mapped_column(String(16), default="inbound")
    category: Mapped[str] = mapped_column(String(16), default="cultural")
    duration_days: Mapped[int] = mapped_column(Integer, default=1)
    min_group: Mapped[int] = mapped_column(Integer, default=1)
    max_group: Mapped[int] = mapped_column(Integer, default=16)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    adult_price_minor: Mapped[int] = mapped_column(Integer)
    child_price_minor: Mapped[int | None] = mapped_column(Integer)
    compare_at_price_minor: Mapped[int | None] = mapped_column(Integer)  # crossed-out price for a real discount
    free_cancel_days: Mapped[int] = mapped_column(Integer, default=30)  # free cancellation up to N days before
    deposit_percent: Mapped[int | None] = mapped_column(Integer)  # overrides the site default when set
    hero_image: Mapped[str | None] = mapped_column(String(500))
    gallery: Mapped[list] = mapped_column(JSONB, default=list)
    season_months: Mapped[list] = mapped_column(JSONB, default=list)  # empty = all year
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # published and bookable
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    departures: Mapped[list["Departure"]] = relationship(back_populates="tour")
    days: Mapped[list["TourDay"]] = relationship(back_populates="tour", order_by="TourDay.day_no",
                                                 cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("adult_price_minor >= 0", name="adult_price"),
        CheckConstraint("child_price_minor IS NULL OR child_price_minor >= 0", name="child_price"),
        CheckConstraint("compare_at_price_minor IS NULL OR compare_at_price_minor > adult_price_minor", name="compare"),
        CheckConstraint(f"audience IN {AUDIENCES}", name="audience"),
        CheckConstraint(f"category IN {CATEGORIES}", name="category"),
        CheckConstraint("duration_days BETWEEN 1 AND 60", name="duration"),
        CheckConstraint("min_group >= 1 AND max_group >= min_group", name="group"),
        CheckConstraint("free_cancel_days BETWEEN 0 AND 365", name="cancel_days"),
        CheckConstraint("deposit_percent IS NULL OR deposit_percent BETWEEN 0 AND 100", name="deposit"),
        Index("ix_tours_listing", "is_active", "audience", "sort_order"),
    )


class TourDay(Base):
    __tablename__ = "tour_days"

    id: Mapped[uuid.UUID] = uuid_pk()
    tour_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tours.id", ondelete="CASCADE"), index=True)
    day_no: Mapped[int] = mapped_column(Integer)
    i18n: Mapped[dict] = mapped_column(JSONB, default=dict)  # title, body
    overnight: Mapped[str | None] = mapped_column(String(120))

    tour: Mapped[Tour] = relationship(back_populates="days")

    __table_args__ = (UniqueConstraint("tour_id", "day_no", name="uq_tour_days_tour_day"),
                      CheckConstraint("day_no >= 1", name="day_no"))


class Departure(Timestamps, Base):
    """A dated run of a tour with a fixed number of seats. seats_reserved counts paid and held seats."""

    __tablename__ = "departures"

    id: Mapped[uuid.UUID] = uuid_pk()
    tour_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tours.id", ondelete="CASCADE"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    seats_total: Mapped[int] = mapped_column(Integer)
    seats_reserved: Mapped[int] = mapped_column(Integer, default=0)
    price_modifier_percent: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | closed | cancelled

    tour: Mapped[Tour] = relationship(back_populates="departures")

    __table_args__ = (
        UniqueConstraint("tour_id", "start_date", name="uq_departures_tour_start"),
        CheckConstraint("seats_reserved >= 0 AND seats_reserved <= seats_total", name="seats"),
        CheckConstraint("end_date >= start_date", name="dates"),
        CheckConstraint("price_modifier_percent BETWEEN -90 AND 300", name="modifier"),
        CheckConstraint("status IN ('open','closed','cancelled')", name="status"),
        Index("ix_departures_start", "start_date", "status"),
    )

    @property
    def seats_left(self) -> int:
        return self.seats_total - self.seats_reserved
