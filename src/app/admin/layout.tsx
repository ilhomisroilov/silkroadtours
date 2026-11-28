import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/app/fonts";
import { Toaster } from "@/components/ui/toast";
import { adminLocale } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin · Gulistan Travel", template: "%s · Admin · Gulistan Travel" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};
export const viewport: Viewport = { themeColor: "#14235c", width: "device-width", initialScale: 1 };

/** Admin panel shell: Uzbek by default, English on request (ADMIN_LOCALE cookie). Never indexed. */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await adminLocale();
  const messages = (await getMessages({ locale })) as Record<string, unknown>;
  const admin = messages.admin as { common: { close?: string }; nav: { menu: string } };
  return (
    <html lang={locale} className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-dvh bg-sand-soft/60 font-sans text-ink antialiased">
        <NextIntlClientProvider locale={locale} messages={{ admin: messages.admin, errors: messages.errors, common: messages.common, months: messages.months, monthsShort: messages.monthsShort, categories: messages.categories, badges: messages.badges, difficulty: messages.difficulty, meals: messages.meals, accommodationTypes: messages.accommodationTypes, transportModes: messages.transportModes, guide: messages.guide, nav: messages.nav }} timeZone="Asia/Tashkent">
          {children}
          <Toaster closeLabel={admin.common.close ?? "×"} label={admin.nav.menu} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
