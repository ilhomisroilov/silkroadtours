import "server-only";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { savedTripPlans, serviceRequests } from "@/db/schema";
import type { Locale } from "@/db/types";
import { estimateBudget, type BudgetCategory } from "@/lib/trip-helpers";
import type { TripState } from "@/lib/trip-store";
import { TRIP_ID_RE, type TripSaveInput } from "@/validators/trip";

/** saved_trip_plans.request value for Trip Constructor snapshots (AI planner rows hold the visitor's question there). */
export const TRIP_BUILDER_REQUEST = "trip-builder";
/** Snapshots one visitor (IP hash) may save per window. */
export const TRIP_SAVE_LIMIT = 12;
export const TRIP_SAVE_WINDOW_SECONDS = 10 * 60;

export interface TripEstimate {
  totalUsd: number;
  perPersonUsd: number;
  days: number;
  nights: number;
  travellers: number;
  byCategory: Record<BudgetCategory, number>;
}

/** What the plan JSON column holds for a Trip Constructor snapshot. */
interface StoredTripPlan {
  kind: "trip-builder";
  trip: Omit<TripState, "savedId">;
  includeMeals: boolean;
  estimate: TripEstimate;
  ipHash?: string;
}

export interface TripSnapshot {
  id: string;
  locale: string;
  createdAt: Date;
  trip: TripState;
  includeMeals: boolean;
  estimate: TripEstimate;
}

const newId = () => "t" + Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => (b % 36).toString(36)).join("");

function toSnapshot(row: typeof savedTripPlans.$inferSelect): TripSnapshot | null {
  const plan = row.plan as Partial<StoredTripPlan> | null;
  if (!plan || plan.kind !== "trip-builder" || !plan.trip || !Array.isArray(plan.trip.items)) return null;
  return {
    id: row.id,
    locale: row.locale,
    createdAt: row.createdAt,
    trip: { ...plan.trip, savedId: row.id } as TripState,
    includeMeals: plan.includeMeals !== false,
    estimate: plan.estimate ?? estimateOf(plan.trip as TripState, plan.includeMeals !== false),
  };
}

export function estimateOf(trip: TripState, includeMeals: boolean): TripEstimate {
  const b = estimateBudget(trip, { includeMeals: includeMeals && trip.items.length > 0 });
  return { totalUsd: b.totalUsd, perPersonUsd: b.perPersonUsd, days: b.days, nights: b.nights, travellers: b.travellers, byCategory: b.byCategory };
}

export async function tooManyTripSaves(db: Db, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - TRIP_SAVE_WINDOW_SECONDS * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(savedTripPlans)
    .where(and(eq(savedTripPlans.request, TRIP_BUILDER_REQUEST), gt(savedTripPlans.createdAt, since), sql`json_extract(${savedTripPlans.plan}, '$.ipHash') = ${ipHash}`));
  return (row?.n ?? 0) >= TRIP_SAVE_LIMIT;
}

export async function insertTripSnapshot(db: Db, input: TripSaveInput, ipHash: string): Promise<{ id: string; estimate: TripEstimate }> {
  const trip = input.trip as TripState;
  const estimate = estimateOf(trip, input.includeMeals);
  const plan: StoredTripPlan = { kind: "trip-builder", trip, includeMeals: input.includeMeals, estimate, ipHash };
  const id = newId();
  await db.insert(savedTripPlans).values({ id, conversationId: null, locale: input.locale, request: TRIP_BUILDER_REQUEST, plan });
  return { id, estimate };
}

export async function getTripSnapshot(db: Db, id: string): Promise<TripSnapshot | null> {
  if (!TRIP_ID_RE.test(id)) return null;
  const [row] = await db
    .select()
    .from(savedTripPlans)
    .where(and(eq(savedTripPlans.id, id), eq(savedTripPlans.request, TRIP_BUILDER_REQUEST)))
    .limit(1);
  return row ? toSnapshot(row) : null;
}

export async function listTripSnapshots(db: Db, opts: { page: number; pageSize: number }): Promise<{ items: TripSnapshot[]; total: number }> {
  const where = eq(savedTripPlans.request, TRIP_BUILDER_REQUEST);
  const [rows, [tot]] = await Promise.all([
    db
      .select()
      .from(savedTripPlans)
      .where(where)
      .orderBy(desc(savedTripPlans.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ n: count() }).from(savedTripPlans).where(where),
  ]);
  return { items: rows.map(toSnapshot).filter((x): x is TripSnapshot => !!x), total: tot?.n ?? 0 };
}

/** Public view of a snapshot (no internal fields). */
export function publicSnapshot(s: TripSnapshot, locale?: Locale) {
  return { id: s.id, trip: s.trip, includeMeals: s.includeMeals, estimate: s.estimate, createdAt: s.createdAt.toISOString(), locale: locale ?? s.locale };
}

/** Service requests (custom tour inquiries) sent with each of these trip ids. */
export async function requestsForTrips(db: Db, ids: string[]): Promise<Map<string, { id: number; reference: string; fullName: string; createdAt: Date }[]>> {
  const out = new Map<string, { id: number; reference: string; fullName: string; createdAt: Date }[]>();
  if (ids.length === 0) return out;
  const tripId = sql<string>`json_extract(${serviceRequests.payload}, '$.tripId')`;
  const rows = await db
    .select({ id: serviceRequests.id, reference: serviceRequests.reference, fullName: serviceRequests.fullName, createdAt: serviceRequests.createdAt, tripId })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.type, "custom_tour"), inArray(tripId, ids)))
    .orderBy(desc(serviceRequests.createdAt));
  for (const r of rows) {
    if (!out.has(r.tripId)) out.set(r.tripId, []);
    out.get(r.tripId)!.push({ id: r.id, reference: r.reference, fullName: r.fullName, createdAt: r.createdAt });
  }
  return out;
}
