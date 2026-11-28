import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class BookingIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    departure_id: uuid.UUID
    adults: int = Field(ge=1, le=30)
    children: int = Field(0, ge=0, le=29)
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(pattern=r"^\+?[0-9][0-9 ()\-]{6,24}$")
    locale: Literal["uz", "ru", "en"] = "en"
    special_requests: str | None = Field(None, max_length=2000)


class Money(BaseModel):
    currency: str
    amount_minor: int


class BookingOut(BaseModel):
    reference: str
    status: str
    payment_state: str
    tour_title: str
    start_date: date | None
    adults: int
    children: int
    total: Money
    deposit: Money
    paid: Money
    amount_due: Money
    hold_expires_at: datetime | None


class BookingCreated(BookingOut):
    access_token: str = Field(description="Shown once. Needed to view and pay this booking without an account.")


class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["payme", "click"]


class PaymentOut(BaseModel):
    order_no: int
    provider: str
    amount_uzs_tiyin: int
    checkout_url: str
