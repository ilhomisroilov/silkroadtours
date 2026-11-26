import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "./client";

/** D1 batches run atomically (all statements commit or none do). Empty input is a no-op. */
export async function runBatch(db: Db, items: BatchItem<"sqlite">[]): Promise<void> {
  if (items.length === 0) return;
  await db.batch(items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Today's date in Uzbekistan (UTC+5), "YYYY-MM-DD". */
export function todayTashkent(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

/** Start of a Tashkent calendar day as a Date (for comparing against unix-second timestamps). */
export function tashkentDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+05:00`);
}
