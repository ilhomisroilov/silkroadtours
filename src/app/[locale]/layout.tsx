import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/app/fonts";
import { ClientMessages } from "@/components/common/client-messages";
import { MotionProvider } from "@/components/common/motion";
import { FloatingContact, SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import { AssistantWidget } from "@/components/ai/assistant-widget";
import { KeepExploring } from "@/components/common/keep-exploring";
import { getDb } from "@/db/client";
import { getAiSettings } from "@/lib/ai/agent";
import type { Locale } from "@/db/types";
import { routing } from "@/i18n/routing";
import { requestCurrency, siteUrl } from "@/lib/server/site";
import { uzText } from "@/lib/uz-alphabet";
import { BRAND } from "@/lib/brand";
import { THEME_SCRIPT } from "@/components/layout/theme-toggle";

export const viewport: Viewport = {
  themeColor: "#0e1830",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("defaultTitle"), template: t("titleTemplate") },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    icons: { icon: BRAND.icon, apple: BRAND.appleIcon },
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  const currency = await requestCurrency(locale);
  const ai = await getAiSettings(getDb()).catch(() => null);

  return (
    <html lang={locale} className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* First thing in <body> (works on every page, the 404 included), before anything is painted. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-lapis px-5 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t("skipToContent")}
        </a>
        <ClientMessages namespaces={[]}>
          <MotionProvider>
            <SiteHeader locale={locale} currency={currency} />
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <SiteFooter locale={locale} />
            <FloatingContact locale={locale} />
            <KeepExploring locale={locale} />
            {ai && <AssistantWidget locale={locale} welcome={locale === "uz" && ai.welcome.uz ? uzText(ai.welcome.uz) : (ai.welcome[locale] ?? ai.welcome.en)} enabled={ai.enabled} />}
          </MotionProvider>
        </ClientMessages>
        <OrganizationJsonLd locale={locale} />
      </body>
    </html>
  );
}
