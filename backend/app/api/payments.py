"""Provider callbacks. Payme and Click call these from their servers; travellers never do."""

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.ratelimit import client_ip
from app.db import SessionLocal
from app.models import PaymentEvent
from app.services.payments.click import BAD_REQUEST, ClickHandler
from app.services.payments.payme import AUTH, PARSE, PaymeError, PaymeHandler, check_auth

router = APIRouter(prefix="/payments", tags=["payments"], include_in_schema=False)
log = logging.getLogger("nt.payments")


async def _log_event(provider: str, method: str, request: dict, response: dict, ip: str) -> None:
    try:
        async with SessionLocal() as s:
            s.add(PaymentEvent(provider=provider, method=method, request=request, response=response, ip=ip))
            await s.commit()
    except Exception:  # an audit write must never turn a good payment answer into an error
        log.exception("could not store payment event")


@router.post("/payme")
async def payme(request: Request) -> JSONResponse:
    ip = client_ip(request)
    rpc_id = None
    try:
        body = json.loads(await request.body())
        if not isinstance(body, dict):
            raise ValueError
        rpc_id = body.get("id")
        method = str(body.get("method", ""))
    except ValueError:
        body, method = {}, "?"
        response = {"jsonrpc": "2.0", "id": None, "error": PaymeError(PARSE).as_dict()}
        await _log_event("payme", method, body, response, ip)
        return JSONResponse(response)

    if not check_auth(request.headers.get("authorization")):
        response = {"jsonrpc": "2.0", "id": rpc_id, "error": PaymeError(AUTH).as_dict()}
        await _log_event("payme", method, body, response, ip)
        return JSONResponse(response)

    async with SessionLocal() as s:
        try:
            result = await PaymeHandler(s).dispatch(method, body.get("params") or {})
            await s.commit()
            response = {"jsonrpc": "2.0", "id": rpc_id, "result": result}
        except PaymeError as e:
            await s.rollback()
            response = {"jsonrpc": "2.0", "id": rpc_id, "error": e.as_dict()}
    await _log_event("payme", method, body, response, ip)
    return JSONResponse(response)


@router.post("/click/prepare")
@router.post("/click/complete")
async def click(request: Request) -> JSONResponse:
    ip = client_ip(request)
    form = {k: str(v) for k, v in (await request.form(max_files=0, max_fields=40)).items()}
    async with SessionLocal() as s:
        try:
            response = await ClickHandler(s).handle(form)
            await s.commit()
        except Exception:
            await s.rollback()
            log.exception("click handler failed")
            response = {"error": BAD_REQUEST, "error_note": "Error in request from click"}
    safe = {k: v for k, v in form.items() if k != "sign_string"}
    await _log_event("click", f"action:{form.get('action', '?')}", safe, response, ip)
    return JSONResponse(response)


