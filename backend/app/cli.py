"""Server-side commands, run inside the API container, for example:

    docker compose exec api python -m app.cli create-owner owner@gulistantravel.uz "Full Name"
    docker compose exec api python -m app.cli set-role manager@gulistantravel.uz manager

The password is typed at a hidden prompt, so it never lands in shell history or logs. The first sign-in then
asks the person to set up two-step verification in an authenticator app.
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.core.permissions import ROLE_PERMISSIONS
from app.db import SessionLocal
from app.models import AuditLog, User, UserIdentity
from app.services.accounts import hash_password, normalise_email, now, revoke_all_sessions

MIN_STAFF_PASSWORD = 12


def _read_password() -> str:
    first = getpass.getpass("Password (12+ characters): ")
    if len(first) < MIN_STAFF_PASSWORD:
        sys.exit("Password is too short.")
    if getpass.getpass("Repeat password: ") != first:
        sys.exit("Passwords do not match.")
    return first


async def create_owner(email: str, full_name: str, password: str) -> str:
    email = normalise_email(email)
    async with SessionLocal() as session, session.begin():
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, full_name=full_name, locale="uz")
            session.add(user)
            await session.flush()
        user.role = "owner"
        user.is_active = True
        user.password_hash = hash_password(password)
        user.email_verified_at = user.email_verified_at or now()
        if not await session.scalar(select(UserIdentity.id).where(UserIdentity.user_id == user.id,
                                                                   UserIdentity.provider == "password")):
            session.add(UserIdentity(user_id=user.id, provider="password", subject=str(user.id), email=email))
        await revoke_all_sessions(session, user.id)
        session.add(AuditLog(actor="cli", action="staff.create_owner", entity="user", entity_id=str(user.id),
                             data={"email": email}))
        return str(user.id)


async def set_role(email: str, role: str) -> None:
    if role not in ROLE_PERMISSIONS:
        sys.exit(f"Unknown role. Choose one of: {', '.join(ROLE_PERMISSIONS)}")
    async with SessionLocal() as session, session.begin():
        user = await session.scalar(select(User).where(User.email == normalise_email(email)))
        if user is None:
            sys.exit("No account with that email. The person should sign up on the site first.")
        old, user.role = user.role, role
        await revoke_all_sessions(session, user.id)
        session.add(AuditLog(actor="cli", action="staff.role", entity="user", entity_id=str(user.id),
                             data={"from": old, "to": role}))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-owner", help="Create the owner account, or reset its password")
    p.add_argument("email")
    p.add_argument("full_name")
    r = sub.add_parser("set-role", help="Give an existing account a staff role (or 'tourist' to remove it)")
    r.add_argument("email")
    r.add_argument("role")
    args = parser.parse_args(argv)

    if args.command == "create-owner":
        user_id = asyncio.run(create_owner(args.email, args.full_name, _read_password()))
        print(f"Owner ready ({user_id}). Sign in on the site and set up two-step verification.")
    else:
        asyncio.run(set_role(args.email, args.role))
        print("Role updated. The person must sign in again.")


if __name__ == "__main__":
    main()
