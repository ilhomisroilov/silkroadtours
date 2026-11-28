LOCALES = ("uz", "ru", "en")
FALLBACK = {"uz": ("uz", "ru", "en"), "ru": ("ru", "en", "uz"), "en": ("en", "ru", "uz")}


def pick(i18n: dict | None, locale: str, field: str, default: str = "") -> str:
    """The text in the visitor's language, else the nearest one that exists."""
    i18n = i18n or {}
    for lang in FALLBACK.get(locale, FALLBACK["en"]):
        value = (i18n.get(lang) or {}).get(field)
        if value:
            return value
    return default


def pick_list(i18n: dict | None, locale: str, field: str) -> list:
    i18n = i18n or {}
    for lang in FALLBACK.get(locale, FALLBACK["en"]):
        value = (i18n.get(lang) or {}).get(field)
        if value:
            return list(value)
    return []
