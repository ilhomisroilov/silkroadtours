import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "../client";
import type { LocalizedText } from "../types";
import { tashkentDayStart, todayTashkent } from "../batch";
import { upcomingDepartures } from "./tours";

const TZ_OFFSET_SECONDS = 5 * 3600;

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

/**
 * Dashboard analytics for bookings created between `from` and `to` (inclusive, Tashkent dates).
 * Revenue estimate = confirmed + completed quotes, normalised to USD cents.
 */
export async function getDashboardStats(db: Db, range: { from?: string; to?: string }) {
  const to = range.to ?? todayTashkent();
  const from = range.from ?? todayTashkent(new Date(tashkentDayStart(to).getTime() - 29 * 86400_000));
  const fromTs = Math.floor(tashkentDayStart(from).getTime() / 1000);
  const toTs = Math.floor(tashkentDayStart(to).getTime() / 1000) + 86400;
  const inRange = sql`b.created_at >= ${fromTs} AND b.created_at < ${toTs}`;

  const [totals, byStatus, byAudience, topDestinations, daily, requestsByType, departures] = await Promise.all([
    db.all<{ bookings: number; guests: number; revenue_usd_cents: number; pipeline_usd_cents: number }>(sql`
      SELECT COUNT(*) AS bookings,
             COALESCE(SUM(b.adults + b.children), 0) AS guests,
             COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.quote_total_usd_cents END), 0) AS revenue_usd_cents,
             COALESCE(SUM(CASE WHEN b.status = 'pending' THEN b.quote_total_usd_cents END), 0) AS pipeline_usd_cents
      FROM bookings b WHERE ${inRange}`),
    db.all<{ status: string; n: number }>(sql`
      SELECT b.status AS status, COUNT(*) AS n FROM bookings b WHERE ${inRange} GROUP BY b.status`),
    db.all<{ audience: string; n: number; revenue_usd_cents: number }>(sql`
      SELECT b.audience AS audience, COUNT(*) AS n,
             COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.quote_total_usd_cents END), 0) AS revenue_usd_cents
      FROM bookings b WHERE ${inRange} GROUP BY b.audience`),
    db.all<{ id: number; slug: string; name: string; n: number }>(sql`
      SELECT d.id AS id, d.slug AS slug, d.name AS name, COUNT(*) AS n
      FROM bookings b
      LEFT JOIN tours t ON t.id = b.tour_id
      JOIN destinations d ON d.id = COALESCE(t.primary_destination_id, b.destination_id)
      WHERE ${inRange}
      GROUP BY d.id ORDER BY n DESC LIMIT 9`),
    db.all<{ day: string; n: number }>(sql`
      SELECT date(b.created_at + ${TZ_OFFSET_SECONDS}, 'unixepoch') AS day, COUNT(*) AS n
      FROM bookings b WHERE ${inRange} GROUP BY day ORDER BY day`),
    db.all<{ type: string; n: number }>(sql`
      SELECT s.type AS type, COUNT(*) AS n FROM service_requests s
      WHERE s.created_at >= ${fromTs} AND s.created_at < ${toTs} GROUP BY s.type`),
    upcomingDepartures(db, 30),
  ]);

  // Fill empty days so charts have a continuous x-axis.
  const counts = new Map<string, number>(daily.map((d): [string, number] => [d.day, Number(d.n)]));
  const series: { day: string; bookings: number }[] = [];
  for (let t = tashkentDayStart(from).getTime(); t < toTs * 1000; t += 86400_000) {
    const day = todayTashkent(new Date(t));
    series.push({ day, bookings: counts.get(day) ?? 0 });
  }

  const t = totals[0] ?? { bookings: 0, guests: 0, revenue_usd_cents: 0, pipeline_usd_cents: 0 };
  return {
    range: { from, to },
    totals: {
      bookings: t.bookings,
      guests: t.guests,
      revenueUsdCents: t.revenue_usd_cents,
      pipelineUsdCents: t.pipeline_usd_cents,
    },
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    byAudience: byAudience.map((r) => ({ audience: r.audience, bookings: r.n, revenueUsdCents: r.revenue_usd_cents })),
    topDestinations: topDestinations.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: parseJson<LocalizedText>(r.name),
      bookings: r.n,
    })),
    daily: series,
    serviceRequestsByType: Object.fromEntries(requestsByType.map((r) => [r.type, r.n])),
    upcomingDepartures: departures,
  };
}
