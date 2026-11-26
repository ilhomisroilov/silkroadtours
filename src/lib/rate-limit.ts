import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { bookings, loginAttempts, serviceRequests } from "@/db/schema";

/** Public form submissions allowed per client (IP hash) per window. */
export const SUBMISSION_LIMIT = 5;
export const SUBMISSION_WINDOW_SECONDS = 10 * 60;

export async function tooManySubmissions(db: Db, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - SUBMISSION_WINDOW_SECONDS * 1000);
  const [[b], [s]] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(and(eq(bookings.ipHash, ipHash), gt(bookings.createdAt, since))),
    db
      .select({ n: count() })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.ipHash, ipHash), gt(serviceRequests.createdAt, since))),
  ]);
  return (b?.n ?? 0) + (s?.n ?? 0) >= SUBMISSION_LIMIT;
}

/** Failed admin logins allowed per (email, IP hash) key per window. */
export const LOGIN_LIMIT = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function isLoginLocked(db: Db, key: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_SECONDS * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)));
  return (row?.n ?? 0) >= LOGIN_LIMIT;
}

export async function recordFailedLogin(db: Db, key: string): Promise<void> {
  await db.insert(loginAttempts).values({ key });
  // Keep the table small.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 3600 * 1000)));
}

export async function clearFailedLogins(db: Db, key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
