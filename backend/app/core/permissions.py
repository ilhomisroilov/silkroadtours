"""What each staff role may do. Permissions, not roles, are checked in the code, so a new role is one line here."""

STAFF_ROLES = ("manager", "editor", "finance", "admin", "owner")

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "tourist": set(),
    "manager": {"dashboard.view", "booking.view", "booking.update", "booking.note", "request.view", "request.update",
                "request.convert", "catalog.view"},
    "editor": {"dashboard.view", "catalog.view", "catalog.edit"},
    "finance": {"dashboard.view", "booking.view", "booking.note", "payment.record", "payment.refund", "catalog.view"},
    "admin": {"dashboard.view", "booking.view", "booking.update", "booking.note", "request.view", "request.update",
              "request.convert", "catalog.view", "catalog.edit", "catalog.price", "payment.record", "audit.view"},
}
ROLE_PERMISSIONS["owner"] = set().union(*ROLE_PERMISSIONS.values()) | {"staff.manage", "payment.refund"}


def can(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
