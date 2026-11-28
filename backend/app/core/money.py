"""Money is always an integer number of minor units (cents, tiyin). Never floats."""

from decimal import ROUND_HALF_UP, Decimal

CURRENCIES = ("USD", "EUR", "UZS", "RUB")


def apply_percent(amount_minor: int, percent: int) -> int:
    """amount * (100 + percent) / 100, rounded half up."""
    value = Decimal(amount_minor) * Decimal(100 + percent) / Decimal(100)
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def share(amount_minor: int, percent: int) -> int:
    """percent of amount, rounded half up (used for deposits)."""
    value = Decimal(amount_minor) * Decimal(percent) / Decimal(100)
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def to_uzs_tiyin(amount_minor: int, rate_uzs_per_unit: Decimal) -> int:
    """Convert a foreign amount in cents to UZS tiyin (1 so'm = 100 tiyin) at a fixed rate."""
    value = Decimal(amount_minor) * rate_uzs_per_unit
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))
