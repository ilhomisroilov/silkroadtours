import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/** Namespaces every page's client components may use (header switchers, forms, errors). */
export const BASE_CLIENT_NAMESPACES = ["nav", "audience", "currency", "languages", "common", "errorPage"] as const;

/**
 * Sends only the message namespaces a page's client components need,
 * instead of the whole dictionary, to keep the HTML payload small.
 */
export async function ClientMessages({ namespaces, children }: { namespaces: readonly string[]; children: ReactNode }) {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()]);
  const picked: Record<string, unknown> = {};
  for (const ns of new Set([...BASE_CLIENT_NAMESPACES, ...namespaces])) {
    if (ns in messages) picked[ns] = (messages as Record<string, unknown>)[ns];
  }
  return (
    <NextIntlClientProvider locale={locale} messages={picked} timeZone="Asia/Tashkent">
      {children}
    </NextIntlClientProvider>
  );
}
