import "server-only";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { notFound } from "@/lib/http";
import { isUniqueViolation } from "@/lib/http";
import { withUniqueReference } from "@/lib/reference";
import type { Db } from "../client";
import { serviceRequests } from "../schema";
import type { BookingStatus, ContactChannel, Locale, ServiceType } from "../types";

export interface NewServiceRequest {
  type: ServiceType;
  fullName: string;
  email: string;
  phone: string;
  contactChannel: ContactChannel;
  messengerHandle?: string | null;
  locale: Locale;
  payload: Record<string, unknown>;
  ipHash: string;
}

export async function insertServiceRequest(db: Db, values: NewServiceRequest) {
  return withUniqueReference(
    "SR",
    async (reference) => {
      const [row] = await db
        .insert(serviceRequests)
        .values({ ...values, reference })
        .returning({ id: serviceRequests.id, reference: serviceRequests.reference });
      if (!row) throw new Error("Service request insert returned no row");
      return row;
    },
    isUniqueViolation,
  );
}

export async function markServiceRequestNotified(db: Db, id: number): Promise<void> {
  await db.update(serviceRequests).set({ telegramNotifiedAt: new Date() }).where(eq(serviceRequests.id, id));
}

export async function listServiceRequests(
  db: Db,
  f: { type?: ServiceType; status?: BookingStatus; page: number; pageSize: number },
) {
  const conds: (SQL | undefined)[] = [];
  if (f.type) conds.push(eq(serviceRequests.type, f.type));
  if (f.status) conds.push(eq(serviceRequests.status, f.status));
  const where = and(...conds);
  const [totalRow] = await db.select({ n: count() }).from(serviceRequests).where(where);
  const items = await db
    .select({
      id: serviceRequests.id,
      reference: serviceRequests.reference,
      type: serviceRequests.type,
      status: serviceRequests.status,
      fullName: serviceRequests.fullName,
      email: serviceRequests.email,
      phone: serviceRequests.phone,
      contactChannel: serviceRequests.contactChannel,
      locale: serviceRequests.locale,
      telegramNotifiedAt: serviceRequests.telegramNotifiedAt,
      createdAt: serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .where(where)
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  return { items, total: totalRow?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function getServiceRequest(db: Db, id: number) {
  const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  return row ?? null;
}

export async function updateServiceRequest(
  db: Db,
  id: number,
  patch: { status?: BookingStatus; internalNotes?: string },
): Promise<void> {
  const updated = await db
    .update(serviceRequests)
    .set(patch)
    .where(eq(serviceRequests.id, id))
    .returning({ id: serviceRequests.id });
  if (updated.length === 0) throw notFound();
}
