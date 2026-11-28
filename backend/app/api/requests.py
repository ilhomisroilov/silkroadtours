"""Requests a manager prices by hand: hotels, transfers and trains, private guides, tailor-made trips, visas."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.ratelimit import limit
from app.core.tokens import booking_reference
from app.db import get_session
from app.models import ServiceRequest
from app.services.accounts import session_user

router = APIRouter(prefix="/v1/requests", tags=["requests"])


class HotelDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["hotel"]
    city: str = Field(max_length=80)
    rooms: int = Field(1, ge=1, le=20)
    stars: int | None = Field(None, ge=1, le=5)
    place_slug: str | None = Field(None, max_length=160)


class TransportDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["transport"]
    mode: Literal["car", "minivan", "bus", "train", "flight"]
    from_city: str = Field(max_length=80)
    to_city: str = Field(max_length=80)
    pickup_time: str | None = Field(None, max_length=40)


class GuideDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["guide"]
    city: str = Field(max_length=80)
    language: str = Field(max_length=20)
    hours: int = Field(4, ge=1, le=240)


class CustomTourDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["custom_tour"]
    cities: list[str] = Field(default_factory=list, max_length=20)
    interests: list[str] = Field(default_factory=list, max_length=20)
    comfort: Literal["budget", "comfort", "premium"] = "comfort"
    trip_plan_id: str | None = Field(None, max_length=64)  # from the trip builder or the AI planner


class VisaDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["visa"]
    citizenship: str = Field(max_length=2)


class OtherDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["other"]


Details = Annotated[HotelDetails | TransportDetails | GuideDetails | CustomTourDetails | VisaDetails | OtherDetails,
                    Field(discriminator="kind")]


class RequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    details: Details
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(pattern=r"^\+?[0-9][0-9 ()\-]{6,24}$")
    contact_channel: Literal["email", "phone", "telegram", "whatsapp"] = "email"
    locale: Literal["uz", "ru", "en"] = "en"
    start_date: date | None = None
    end_date: date | None = None
    adults: int = Field(1, ge=1, le=100)
    children: int = Field(0, ge=0, le=100)
    budget_minor: int | None = Field(None, ge=0)
    currency: Literal["USD", "EUR", "UZS", "RUB"] = "USD"
    message: str | None = Field(None, max_length=3000)
    source: str | None = Field(None, max_length=64)
    website: str | None = Field(None, max_length=200, description="Leave empty (spam trap)")

    @model_validator(mode="after")
    def dates(self):
        if self.start_date and self.start_date < date.today():
            raise ValueError("start_date is in the past")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date is before start_date")
        return self


@router.post("", status_code=201, dependencies=[Depends(limit("request.create", times=8, seconds=600))])
async def create(body: RequestIn, request: Request, session: AsyncSession = Depends(get_session)):
    if body.website:  # bots fill every field; people never see this one
        return {"reference": booking_reference(get_settings().request_prefix), "status": "new"}
    signed = await session_user(session, request.cookies.get(get_settings().session_cookie))
    data = body.model_dump(exclude={"details", "website"})
    req = ServiceRequest(reference=booking_reference(get_settings().request_prefix), kind=body.details.kind, status="new",
                         details=body.details.model_dump(mode="json", exclude={"kind"}),
                         user_id=signed[1].id if signed else None, **data | {"email": str(body.email).lower()})
    session.add(req)
    await session.commit()
    return {"reference": req.reference, "status": req.status}
