// The admin panel is in Uzbek (default) or English, chosen with a cookie.
export const ADMIN_LOCALES = ["uz", "en"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const ADMIN_LOCALE_COOKIE = "ADMIN_LOCALE";
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "uz";

export function resolveAdminLocale(cookie: string | undefined | null): AdminLocale {
  return (ADMIN_LOCALES as readonly string[]).includes(cookie ?? "") ? (cookie as AdminLocale) : DEFAULT_ADMIN_LOCALE;
}
