import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { getDb, getEnv } from "@/db/client";
import { getContact, getRates } from "@/db/queries/settings";
import { LOCALES, type Currency, type Locale } from "@/db/types";
import { getPathname } from "@/i18n/navigation";
import { CURRENCY_COOKIE, resolveCurrency } from "@/lib/currency";

/** One D1 handle per request. */
export const db = cache(() => getDb());
export const contactSettings = cache(async () => getContact(db()));
export const exchangeRates = cache(async () => getRates(db()));

export function siteUrl(): string {
  let url = "";
  try {
    url = getEnv().SITE_URL ?? "";
  } catch {
    // no Cloudflare context (e.g. during static analysis)
  }
  url ||= process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/** The visitor's currency: CURRENCY cookie → UZS for Uzbek pages / domestic hub → site default. */
export async function requestCurrency(locale: Locale, context?: "domestic"): Promise<Currency> {
  const store = await cookies();
  let siteDefault: string | undefined;
  try {
    siteDefault = getEnv().DEFAULT_CURRENCY;
  } catch {
    siteDefault = undefined;
  }
  return resolveCurrency({ cookie: store.get(CURRENCY_COOKIE)?.value, locale, siteDefault, context });
}

type Href = Parameters<typeof getPathname>[0]["href"];

/** Absolute URL of a localized page. */
export function absoluteUrl(locale: Locale, href: Href): string {
  return siteUrl() + getPathname({ locale, href });
}

/**
 * Canonical + hreflang alternates + Open Graph/Twitter basics for a localized page.
 * `title` is the page title without the site name (the layout template adds it).
 */
export async function pageMetadata(opts: {
  locale: Locale;
  href: Href;
  title: string;
  description?: string;
  image?: string | null;
  noIndex?: boolean;
  absoluteTitle?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: opts.locale, namespace: "meta" });
  const description = opts.description ?? t("defaultDescription");
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = absoluteUrl(l, opts.href);
  languages["x-default"] = absoluteUrl("en", opts.href);
  const url = absoluteUrl(opts.locale, opts.href);
  const ogImage = opts.image && /^https:\/\//.test(opts.image) ? opts.image : `${siteUrl()}/og-default.png`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: "website",
      url,
      siteName: t("siteName"),
      title: opts.title,
      description,
      locale: { en: "en_US", uz: "uz_UZ", ru: "ru_RU" }[opts.locale],
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: opts.title, description, images: [ogImage] },
    robots: opts.noIndex ? { index: false, follow: true } : undefined,
  };
}

export { messengerLinks } from "@/lib/links";
