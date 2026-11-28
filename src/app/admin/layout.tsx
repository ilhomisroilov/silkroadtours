import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/app/fonts";
import { Toaster } from "@/components/ui/toast";
import { AdminAntdProvider } from "@/components/admin/antd-provider";
import { adminLocale } from "@/lib/server/admin";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `Admin · ${BRAND.name}`, template: `%s · Admin · ${BRAND.name}` },
  robots: { index: false, follow: false },
  icons: { icon: BRAND.icon, apple: BRAND.appleIcon },
};
export const viewport: Viewport = { themeColor: "#061a2e", width: "device-width", initialScale: 1 };

/** Admin panel shell: Uzbek by default, English on request (ADMIN_LOCALE cookie). Never indexed. */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await adminLocale();
  const messages = (await getMessages({ locale })) as Record<string, unknown>;
  const admin = messages.admin as { common: { close?: string }; nav: { menu: string } };
  return (
    <html lang={locale} className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="admin-root min-h-dvh font-sans antialiased" style={{ background: "#f4f6f9", color: "#14202b" }}>
        <NextIntlClientProvider locale={locale} messages={{ admin: messages.admin, errors: messages.errors, common: messages.common, months: messages.months, monthsShort: messages.monthsShort, categories: messages.categories, badges: messages.badges, difficulty: messages.difficulty, meals: messages.meals, accommodationTypes: messages.accommodationTypes, transportModes: messages.transportModes, guide: messages.guide, nav: messages.nav }} timeZone="Asia/Tashkent">
          <AdminAntdProvider locale={locale}>{children}</AdminAntdProvider>
          <Toaster closeLabel={admin.common.close ?? "×"} label={admin.nav.menu} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
