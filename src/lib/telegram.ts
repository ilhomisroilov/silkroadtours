// Telegram Bot API notifier. Messages use parse_mode=HTML, so every dynamic value is escaped.

import type { BookingType, ContactChannel, Currency, Locale, ServiceType } from "../db/types";
import { formatMoney } from "./pricing";

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_MAX_LENGTH = 4096;
const TIMEOUT_MS = 8000;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function line(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(String(value))}`;
}

function contactLinks(phone: string, channel: ContactChannel, handle?: string | null): string {
  const digits = phone.replace(/\D/g, "");
  const links = [`<a href="tel:+${digits}">+${digits}</a>`, `<a href="https://wa.me/${digits}">WhatsApp</a>`];
  const tg = (handle ?? "").replace(/^@/, "").trim();
  if (channel === "telegram" && /^[A-Za-z0-9_]{5,32}$/.test(tg)) {
    links.push(`<a href="https://t.me/${tg}">Telegram @${escapeHtml(tg)}</a>`);
  }
  return links.join(" · ");
}

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  phone: "Phone call",
  email: "Email",
};

export interface BookingNotification {
  id: number;
  reference: string;
  audience: "inbound" | "domestic";
  bookingType: BookingType;
  tourTitle: string | null;
  destinationName: string | null;
  preferredDate: string;
  adults: number;
  children: number;
  fullName: string;
  email: string;
  phone: string;
  contactChannel: ContactChannel;
  messengerHandle?: string | null;
  country?: string | null;
  locale: Locale;
  specialRequests?: string | null;
  quote?: { totalMinor: number; currency: Currency } | null;
}

export function formatBookingMessage(b: BookingNotification, siteUrl: string): string {
  const audience = b.audience === "inbound" ? "🌍 Inbound" : "🇺🇿 Domestic";
  const pax = `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`;
  const parts = [
    `🆕 <b>New booking ${escapeHtml(b.reference)}</b> — ${audience}`,
    "",
    line("Tour", b.tourTitle),
    b.tourTitle ? null : line("Destination enquiry", b.destinationName),
    line("Date", b.preferredDate),
    line("Guests", pax),
    line("Type", b.bookingType === "private" ? "Private" : "Group"),
    b.quote ? line("Quote", formatMoney(b.quote.totalMinor, b.quote.currency, "en")) : null,
    "",
    line("Name", b.fullName),
    `<b>Contact:</b> ${contactLinks(b.phone, b.contactChannel, b.messengerHandle)}`,
    line("Prefers", CHANNEL_LABEL[b.contactChannel] + (b.messengerHandle ? ` (${b.messengerHandle})` : "")),
    line("Email", b.email),
    line("Country", b.country),
    line("Site language", b.locale.toUpperCase()),
    b.specialRequests ? `\n<b>Special requests:</b>\n${escapeHtml(b.specialRequests)}` : null,
    "",
    `<a href="${escapeHtml(siteUrl.replace(/\/$/, ""))}/admin/bookings/${b.id}">Open in admin →</a>`,
  ];
  return truncate(parts.filter((p) => p !== null).join("\n"));
}

const SERVICE_LABEL: Record<ServiceType, string> = {
  airport_transfer: "✈️ Airport transfer",
  custom_tour: "🧭 Tailor-made tour",
  accommodation: "🏕 Hotel / yurt camp",
  guide: "🗣 Guide hire",
};

export interface ServiceRequestNotification {
  id: number;
  reference: string;
  type: ServiceType;
  fullName: string;
  email: string;
  phone: string;
  contactChannel: ContactChannel;
  messengerHandle?: string | null;
  locale: Locale;
  payload: Record<string, unknown>;
}

const SKIP_PAYLOAD_KEYS = new Set([
  "type",
  "fullName",
  "email",
  "phone",
  "contactChannel",
  "messengerHandle",
  "locale",
  "turnstileToken",
]);

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function formatServiceRequestMessage(r: ServiceRequestNotification, siteUrl: string): string {
  const details = Object.entries(r.payload)
    .filter(([k, v]) => !SKIP_PAYLOAD_KEYS.has(k) && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => line(humanizeKey(k), Array.isArray(v) ? v.join(", ") : String(v)));
  const parts = [
    `🆕 <b>${SERVICE_LABEL[r.type]} request ${escapeHtml(r.reference)}</b>`,
    "",
    ...details,
    "",
    line("Name", r.fullName),
    `<b>Contact:</b> ${contactLinks(r.phone, r.contactChannel, r.messengerHandle)}`,
    line("Prefers", CHANNEL_LABEL[r.contactChannel] + (r.messengerHandle ? ` (${r.messengerHandle})` : "")),
    line("Email", r.email),
    line("Site language", r.locale.toUpperCase()),
    "",
    `<a href="${escapeHtml(siteUrl.replace(/\/$/, ""))}/admin/requests/${r.id}">Open in admin →</a>`,
  ];
  return truncate(parts.filter((p) => p !== null).join("\n"));
}

function truncate(text: string): string {
  return text.length <= TELEGRAM_MAX_LENGTH ? text : `${text.slice(0, TELEGRAM_MAX_LENGTH - 2)}…`;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export type TelegramResult = { ok: true; messageId: number } | { ok: false; error: string };

export async function sendTelegramMessage(
  config: TelegramConfig,
  html: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramResult> {
  if (!config.botToken || !config.chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as
      | { ok: true; result: { message_id: number } }
      | { ok: false; description?: string }
      | null;
    if (!body) return { ok: false, error: `Telegram HTTP ${res.status}` };
    if (!body.ok) return { ok: false, error: body.description ?? `Telegram HTTP ${res.status}` };
    return { ok: true, messageId: body.result.message_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
