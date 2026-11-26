// Which currency a visitor sees. Pure logic so it can be unit-tested.
import { CURRENCIES, type Currency, type Locale } from "../db/types";

export const CURRENCY_COOKIE = "CURRENCY";
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * 1. A valid CURRENCY cookie always wins (the visitor chose it).
 * 2. Otherwise Uzbek pages and the domestic hub default to so'm.
 * 3. Otherwise the site default (wrangler var DEFAULT_CURRENCY, normally USD).
 */
export function resolveCurrency(opts: {
  cookie?: string | null;
  locale: Locale;
  siteDefault?: string | null;
  context?: "domestic";
}): Currency {
  if (isCurrency(opts.cookie)) return opts.cookie;
  if (opts.locale === "uz" || opts.context === "domestic") return "UZS";
  return isCurrency(opts.siteDefault) ? opts.siteDefault : "USD";
}

/** Cookie string set by the currency switcher (readable by the server on the next request). */
export function currencyCookie(currency: Currency, secure: boolean): string {
  return `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=${CURRENCY_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
