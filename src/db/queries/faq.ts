import "server-only";
import { and, asc, eq, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { notFound } from "@/lib/http";
import type { faqUpsertSchema } from "@/validators/admin";
import type { Db } from "../client";
import { faqItems } from "../schema";
import type { FaqCategory } from "../types";

type FaqUpsert = z.output<typeof faqUpsertSchema>;

export async function listFaq(db: Db, opts: { category?: FaqCategory; includeUnpublished?: boolean } = {}) {
  const conds: (SQL | undefined)[] = [];
  if (!opts.includeUnpublished) conds.push(eq(faqItems.isPublished, true));
  if (opts.category) conds.push(eq(faqItems.category, opts.category));
  return db
    .select()
    .from(faqItems)
    .where(and(...conds))
    .orderBy(asc(faqItems.category), asc(faqItems.sortOrder), asc(faqItems.id));
}

export async function createFaq(db: Db, input: FaqUpsert): Promise<number> {
  const [row] = await db.insert(faqItems).values(input).returning({ id: faqItems.id });
  return row!.id;
}

export async function updateFaq(db: Db, id: number, input: FaqUpsert): Promise<void> {
  const updated = await db.update(faqItems).set(input).where(eq(faqItems.id, id)).returning({ id: faqItems.id });
  if (updated.length === 0) throw notFound();
}

export async function deleteFaq(db: Db, id: number): Promise<void> {
  const deleted = await db.delete(faqItems).where(eq(faqItems.id, id)).returning({ id: faqItems.id });
  if (deleted.length === 0) throw notFound();
}
