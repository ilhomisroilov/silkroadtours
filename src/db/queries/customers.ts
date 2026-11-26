import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { bookings, newsletterSubscribers, serviceRequests } from "../schema";

/**
 * Customers are not a separate table: a customer is everyone who wrote to us with the same email,
 * across tour bookings and service requests (and the newsletter). Built on read, so it is always current.
 */
export interface CustomerSummary {
  email: string;
  name: string;
  phone: string;
  channel: string;
  country: string | null;
  locales: string[];
  bookings: number;
  requests: number;
  subscribed: boolean;
  firstSeen: Date;
  lastSeen: Date;
}

const RECENT_LIMIT = 5000;

export async function listCustomers(db: Db, opts: { q?: string; page: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 25;
  const [b, r, n] = await Promise.all([
    db
      .select({ email: bookings.email, name: bookings.fullName, phone: bookings.phone, channel: bookings.contactChannel, country: bookings.country, locale: bookings.locale, at: bookings.createdAt })
      .from(bookings)
      .orderBy(desc(bookings.createdAt))
      .limit(RECENT_LIMIT),
    db
      .select({ email: serviceRequests.email, name: serviceRequests.fullName, phone: serviceRequests.phone, channel: serviceRequests.contactChannel, locale: serviceRequests.locale, at: serviceRequests.createdAt })
      .from(serviceRequests)
      .orderBy(desc(serviceRequests.createdAt))
      .limit(RECENT_LIMIT),
    db.select({ email: newsletterSubscribers.email }).from(newsletterSubscribers),
  ]);
  const subs = new Set(n.map((x) => x.email.toLowerCase()));
  const map = new Map<string, CustomerSummary>();
  const touch = (row: { email: string; name: string; phone: string; channel: string; country?: string | null; locale: string; at: Date }, kind: "bookings" | "requests") => {
    const key = row.email.trim().toLowerCase();
    let c = map.get(key);
    if (!c) {
      c = { email: key, name: row.name, phone: row.phone, channel: row.channel, country: row.country ?? null, locales: [], bookings: 0, requests: 0, subscribed: subs.has(key), firstSeen: row.at, lastSeen: row.at };
      map.set(key, c);
    }
    c[kind] += 1;
    if (row.at > c.lastSeen) {
      c.lastSeen = row.at;
      c.name = row.name;
      c.phone = row.phone;
      c.channel = row.channel;
    }
    if (row.at < c.firstSeen) c.firstSeen = row.at;
    if (!c.country && row.country) c.country = row.country;
    if (!c.locales.includes(row.locale)) c.locales.push(row.locale);
  };
  b.forEach((x) => touch(x, "bookings"));
  r.forEach((x) => touch(x, "requests"));
  let all = [...map.values()].sort((x, y) => y.lastSeen.getTime() - x.lastSeen.getTime());
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    const digits = needle.replace(/\D/g, "");
    all = all.filter((c) => c.email.includes(needle) || c.name.toLowerCase().includes(needle) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)));
  }
  const page = Math.min(opts.page, Math.max(1, Math.ceil(all.length / pageSize)));
  return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
}

export async function getCustomer(db: Db, email: string) {
  const key = email.trim().toLowerCase();
  const [b, r, n] = await Promise.all([
    db.select().from(bookings).where(eq(sql`lower(${bookings.email})`, key)).orderBy(desc(bookings.createdAt)),
    db.select().from(serviceRequests).where(eq(sql`lower(${serviceRequests.email})`, key)).orderBy(desc(serviceRequests.createdAt)),
    db.select().from(newsletterSubscribers).where(eq(sql`lower(${newsletterSubscribers.email})`, key)).limit(1),
  ]);
  if (b.length === 0 && r.length === 0 && n.length === 0) return null;
  return { email: key, bookings: b, requests: r, subscription: n[0] ?? null };
}
