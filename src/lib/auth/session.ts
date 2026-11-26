import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { adminSessions, adminUsers, type AdminUser } from "@/db/schema";
import { randomToken, sha256Hex } from "../crypto";

export const SESSION_COOKIE = "st_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Sessions are extended when less than this much time is left. */
const RENEW_THRESHOLD_SECONDS = 60 * 60 * 24 * 3;

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
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    ipHash: meta.ipHash,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  // Opportunistic cleanup of expired sessions.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  return token;
}

/** Resolves an active admin from a raw session token, renewing the session when it is close to expiry. */
export async function validateSession(db: Db, token: string | undefined | null): Promise<SessionAdmin | null> {
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const now = new Date();
  const [row] = await db
    .select({
      expiresAt: adminSessions.expiresAt,
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

  if (row.expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD_SECONDS * 1000) {
    await db
      .update(adminSessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000) })
      .where(eq(adminSessions.id, id));
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
