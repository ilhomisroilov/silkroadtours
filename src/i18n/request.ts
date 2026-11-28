import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { ADMIN_LOCALES, type AdminLocale } from "./admin";
import { routing } from "./routing";
import { uzDeep } from "../lib/uz-alphabet";
import { brandDeep } from "../lib/brand";

/**
 * Feature modules keep their messages in their own files, merged on top of the main dictionary:
 *   messages/modules/<module>/<locale>.json        → top-level namespaces for the public site
 *   messages/admin/modules/<module>/<locale>.json  → merged into the "admin" namespace
 */
export const SITE_MESSAGE_MODULES = ["eco", "places", "virtual", "builder", "partners", "aiguide", "payments", "account"] as const;
export const ADMIN_MESSAGE_MODULES = ["crm", "partners", "places", "trips", "aicenter", "panel"] as const;

/**
 * The brand name is swapped in for the deployment's brand (src/lib/brand.ts); Uzbek dictionaries are shown
 * in the new Latin alphabet (the files keep the current spelling as the backup). Cached in production.
 */
const cache = new Map<string, Record<string, unknown>>();
function forLocale(key: string, locale: string, messages: Record<string, unknown>): Record<string, unknown> {
  const build = () => (locale === "uz" ? uzDeep(brandDeep(messages)) : brandDeep(messages));
  if (process.env.NODE_ENV !== "production") return build();
  const k = `${key}:${locale}`;
  const hit = cache.get(k) ?? build();
  cache.set(k, hit);
  return hit;
}

async function siteMessages(locale: string): Promise<Record<string, unknown>> {
  const [base, ...mods] = await Promise.all([
    import(`../../messages/${locale}.json`),
    ...SITE_MESSAGE_MODULES.map((m) => import(`../../messages/modules/${m}/${locale}.json`)),
  ]);
  return forLocale("site", locale, Object.assign({}, base.default, ...mods.map((x) => x.default)));
}

async function adminMessages(locale: string): Promise<Record<string, unknown>> {
  const [base, ...mods] = await Promise.all([
    import(`../../messages/admin/${locale}.json`),
    ...ADMIN_MESSAGE_MODULES.map((m) => import(`../../messages/admin/modules/${m}/${locale}.json`)),
  ]);
  return forLocale("admin", locale, Object.assign({}, base.default, ...mods.map((x) => x.default)));
}

export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  // The admin panel (outside [locale]) passes its locale explicitly: "uz" (default) or "en".
  if (explicit && (ADMIN_LOCALES as readonly string[]).includes(explicit)) {
    const l = explicit as AdminLocale;
    const [site, admin] = await Promise.all([siteMessages(l), adminMessages(l)]);
    return { locale: l, messages: { ...site, admin }, timeZone: "Asia/Tashkent" };
  }
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await siteMessages(locale),
    timeZone: "Asia/Tashkent",
  };
});
