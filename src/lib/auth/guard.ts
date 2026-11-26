import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { assertSameOrigin, forbidden, unauthorized } from "../http";
import { SESSION_COOKIE, validateSession, type SessionAdmin } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** For admin API route handlers. Mutating requests must also come from this origin (CSRF). */
export async function requireAdmin(req: NextRequest): Promise<SessionAdmin> {
  if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
  const admin = await validateSession(getDb(), req.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) throw unauthorized();
  return admin;
}

export async function requireOwner(req: NextRequest): Promise<SessionAdmin> {
  const admin = await requireAdmin(req);
  if (admin.role !== "owner") throw forbidden("owner_only");
  return admin;
}

/** For admin server components / layouts (Phase 4). Returns null when not signed in. */
export async function getAdminFromCookies(): Promise<SessionAdmin | null> {
  const store = await cookies();
  return validateSession(getDb(), store.get(SESSION_COOKIE)?.value);
}
