import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { ADMIN_LOCALE_COOKIE, resolveAdminLocale, type AdminLocale } from "@/i18n/admin";
import { getAdminFromCookies } from "@/lib/auth/guard";

export const adminLocale = cache(async (): Promise<AdminLocale> => resolveAdminLocale((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value));

/** Server-side guard for every admin page: no session → login page. */
export const requireAdminPage = cache(async () => {
  const admin = await getAdminFromCookies();
  if (!admin) redirect("/admin/login");
  return admin;
});

export async function adminT() {
  const locale = await adminLocale();
  return { t: await getTranslations({ locale, namespace: "admin" }), locale };
}
