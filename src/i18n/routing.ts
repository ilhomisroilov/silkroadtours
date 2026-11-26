import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "../db/types";

// URLs: /en/tours/..., /uz/tours/..., /ru/tours/...  (admin lives at /admin, un-prefixed)
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export { CURRENCY_COOKIE } from "../lib/currency";
