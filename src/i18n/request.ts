import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { ADMIN_LOCALES, type AdminLocale } from "./admin";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  // The admin panel (outside [locale]) passes its locale explicitly: "uz" (default) or "en".
  if (explicit && (ADMIN_LOCALES as readonly string[]).includes(explicit)) {
    const l = explicit as AdminLocale;
    const [site, admin] = await Promise.all([
      import(`../../messages/${l}.json`),
      import(`../../messages/admin/${l}.json`),
    ]);
    return { locale: l, messages: { ...site.default, admin: admin.default }, timeZone: "Asia/Tashkent" };
  }
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Tashkent",
  };
});
