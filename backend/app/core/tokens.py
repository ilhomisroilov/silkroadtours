import hashlib
import hmac
import secrets

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid misreading


def booking_reference(prefix: str = "GT") -> str:
    return f"{prefix}-" + "".join(secrets.choice(_ALPHABET) for _ in range(8))


def new_access_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def tokens_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
