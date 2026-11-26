import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { conflict, isUniqueViolation, notFound, unprocessable } from "@/lib/http";
import type { Db } from "../client";
import { adminUsers } from "../schema";
import type { AdminRole } from "../types";

const publicColumns = {
  id: adminUsers.id,
  email: adminUsers.email,
  name: adminUsers.name,
  role: adminUsers.role,
  isActive: adminUsers.isActive,
  lastLoginAt: adminUsers.lastLoginAt,
  createdAt: adminUsers.createdAt,
};

export async function countAdmins(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(adminUsers);
  return row?.n ?? 0;
}

export async function findAdminByEmail(db: Db, email: string) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  return row ?? null;
}

export async function findAdminById(db: Db, id: number) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row ?? null;
}

export async function listAdmins(db: Db) {
  return db.select(publicColumns).from(adminUsers).orderBy(asc(adminUsers.id));
}

export async function createAdmin(
  db: Db,
  input: { email: string; name: string; password: string; role: AdminRole },
): Promise<number> {
  const passwordHash = await hashPassword(input.password);
  try {
    const [row] = await db
      .insert(adminUsers)
      .values({ email: input.email, name: input.name, passwordHash, role: input.role })
      .returning({ id: adminUsers.id });
    return row!.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("email_taken");
    throw err;
  }
}

export async function touchLastLogin(db: Db, id: number): Promise<void> {
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
}

export async function setAdminPassword(db: Db, id: number, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, id));
}

async function activeOwnerCount(db: Db): Promise<number> {
  const rows = await db.select({ role: adminUsers.role, isActive: adminUsers.isActive }).from(adminUsers);
  return rows.filter((r) => r.role === "owner" && r.isActive).length;
}

export async function updateAdmin(
  db: Db,
  id: number,
  actorId: number,
  patch: { name?: string; role?: AdminRole; isActive?: boolean; password?: string },
): Promise<void> {
  const target = await findAdminById(db, id);
  if (!target) throw notFound();

  const losesOwner =
    target.role === "owner" && target.isActive && (patch.role === "editor" || patch.isActive === false);
  if (losesOwner && (await activeOwnerCount(db)) <= 1) throw unprocessable("last_owner");
  if (id === actorId && patch.isActive === false) throw unprocessable("cannot_deactivate_self");

  const { password, ...rest } = patch;
  if (Object.keys(rest).length) await db.update(adminUsers).set(rest).where(eq(adminUsers.id, id));
  if (password) await setAdminPassword(db, id, password);
  // Revoke sessions when access changes or a password is reset.
  if (password || patch.isActive === false || patch.role) await destroyAllSessionsForUser(db, id);
}
