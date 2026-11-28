import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { adminSessions, adminUsers, type AdminUser } from "@/db/schema";
import { SESSION_IDLE_MS } from "../admin-idle";
import { randomToken, sha256Hex } from "../crypto";

export const SESSION_COOKIE = "st_admin";
/** Signed out automatically after this long without any request to the admin. Enforced here, on the server. */
export const SESSION_IDLE_SECONDS = SESSION_IDLE_MS / 1000; // 1 hour
/** Even while active, a session never lives longer than this; then the admin signs in again. */
export const SESSION_MAX_SECONDS = 60 * 60 * 12; // 12 hours
/** Avoids a database write on every request: the idle window is pushed forward at most once a minute. */
const RENEW_EVERY_SECONDS = 60;
/** Kept for the cookie lifetime; the server decides whether the session is still alive. */
export const SESSION_TTL_SECONDS = SESSION_MAX_SECONDS;

export type SessionAdmin = Pick<AdminUser, "id" | "email" | "name" | "role">;

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Creates a session and returns the raw token for the cookie. Only its SHA-256 is stored. */
export async function createSession(
  db: Db,
  userId: number,
  meta: { ipHash?: string; userAgent?: string | null },
): Promise<string> {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  await db.insert(adminSessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_IDLE_SECONDS * 1000),
    ipHash: meta.ipHash,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  // Opportunistic cleanup of expired sessions.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  return token;
}

/** Resolves an active admin from a raw session token. Each request moves the idle deadline one hour ahead,
 *  capped at SESSION_MAX_SECONDS from sign-in; an hour with no requests ends the session. */
export async function validateSession(db: Db, token: string | undefined | null): Promise<SessionAdmin | null> {
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const now = new Date();
  const [row] = await db
    .select({
      expiresAt: adminSessions.expiresAt,
      createdAt: adminSessions.createdAt,
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, now)))
    .limit(1);

  if (!row || !row.isActive) return null;

  const hardStop = row.createdAt.getTime() + SESSION_MAX_SECONDS * 1000;
  if (hardStop <= now.getTime()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, id));
    return null;
  }
  const next = Math.min(now.getTime() + SESSION_IDLE_SECONDS * 1000, hardStop);
  // Also shortens sessions made before the idle limit existed (they carried a 7-day expiry).
  if (Math.abs(next - row.expiresAt.getTime()) >= RENEW_EVERY_SECONDS * 1000) {
    await db.update(adminSessions).set({ expiresAt: new Date(next) }).where(eq(adminSessions.id, id));
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function destroySession(db: Db, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.delete(adminSessions).where(eq(adminSessions.id, await sha256Hex(token)));
}

export async function destroyAllSessionsForUser(db: Db, userId: number): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
}
