import uuid
from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, uuid_pk


class Tour(Timestamps, Base):
    __tablename__ = "tours"

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    adult_price_minor: Mapped[int] = mapped_column(Integer)
    child_price_minor: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    departures: Mapped[list["Departure"]] = relationship(back_populates="tour")

    __table_args__ = (
        CheckConstraint("adult_price_minor >= 0", name="adult_price"),
        CheckConstraint("child_price_minor IS NULL OR child_price_minor >= 0", name="child_price"),
    )


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
    )

    @property
    def seats_left(self) -> int:
        return self.seats_total - self.seats_reserved
