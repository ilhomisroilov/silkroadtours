"""Background jobs: release expired seat holds every minute, refresh exchange rates from the Central Bank
of Uzbekistan, and purge old idempotency records. Run as its own container: python -m app.worker"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from app.db import SessionLocal
from app.models import FxRate, IdempotencyKey
from app.services.booking import expire_holds

log = logging.getLogger("nt.worker")
CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/"
WANTED = {"USD", "EUR", "RUB"}


async def release_holds() -> None:
    async with SessionLocal() as s:
        n = await expire_holds(s)
        await s.commit()
    if n:
        log.info("released %d expired holds", n)


async def refresh_rates() -> None:
    async with httpx.AsyncClient(timeout=10) as http:
        data = (await http.get(CBU_URL)).raise_for_status().json()
    rows = [
        {"currency": r["Ccy"], "uzs_per_unit": Decimal(r["Rate"]) / Decimal(r.get("Nominal") or 1),
         "fetched_at": datetime.now(UTC)}
        for r in data if r.get("Ccy") in WANTED
    ]
    if not rows:
        raise RuntimeError("Central Bank response had no rates")
    async with SessionLocal() as s:
        stmt = insert(FxRate).values(rows)
        await s.execute(stmt.on_conflict_do_update(
            index_elements=["currency"],
            set_={"uzs_per_unit": stmt.excluded.uzs_per_unit, "fetched_at": stmt.excluded.fetched_at}))
        await s.commit()
    log.info("exchange rates updated: %s", ", ".join(r["currency"] for r in rows))


async def purge_idempotency() -> None:
    async with SessionLocal() as s:
        await s.execute(delete(IdempotencyKey).where(IdempotencyKey.created_at < datetime.now(UTC) - timedelta(hours=24)))
        await s.commit()


async def every(seconds: int, job) -> None:
    while True:
        try:
            await job()
        except Exception:
            log.exception("job %s failed", job.__name__)
        await asyncio.sleep(seconds)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    await asyncio.gather(every(60, release_holds), every(6 * 3600, refresh_rates), every(3600, purge_idempotency))


if __name__ == "__main__":
    asyncio.run(main())
