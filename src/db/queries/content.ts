import "server-only";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { contentItems, newsletterSubscribers, type ContentKind } from "../schema";
import type { LocalizedText } from "../types";

export type ContentItem = typeof contentItems.$inferSelect;

export async function listContent(
  db: Db,
  kind: ContentKind,
  opts: { limit?: number; includeUnpublished?: boolean; category?: string; destination?: string } = {},
): Promise<ContentItem[]> {
  const conds: SQL[] = [eq(contentItems.kind, kind)];
  if (!opts.includeUnpublished) conds.push(eq(contentItems.isPublished, true));
  if (opts.category) conds.push(eq(contentItems.category, opts.category));
  if (opts.destination) conds.push(eq(contentItems.destinationSlug, opts.destination));
  const q = db
    .select()
    .from(contentItems)
    .where(and(...conds))
    .orderBy(asc(contentItems.sortOrder), asc(contentItems.id));
  return opts.limit ? q.limit(opts.limit) : q;
}

export async function getPublishedContent(db: Db, kind: ContentKind, slug: string): Promise<ContentItem | null> {
  const [row] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.kind, kind), eq(contentItems.slug, slug), eq(contentItems.isPublished, true)))
    .limit(1);
  return row ?? null;
}

export async function getContentById(db: Db, id: number): Promise<ContentItem | null> {
  const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  return row ?? null;
}

export interface ContentUpsert {
  kind: ContentKind;
  slug: string;
  category: string | null;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  image: string | null;
  destinationSlug: string | null;
  icon: string | null;
  requestType: string | null;
  durationHours: number | null;
  priceFromUsd: number | null;
  readingMinutes: number | null;
  isPublished: boolean;
  sortOrder: number;
}

export async function createContent(db: Db, input: ContentUpsert): Promise<number> {
  const [row] = await db.insert(contentItems).values(input).returning({ id: contentItems.id });
  return row!.id;
}

export async function updateContent(db: Db, id: number, input: Partial<ContentUpsert>): Promise<void> {
  await db.update(contentItems).set(input).where(eq(contentItems.id, id));
}

export async function deleteContent(db: Db, id: number): Promise<void> {
  await db.delete(contentItems).where(eq(contentItems.id, id));
}

export async function contentCounts(db: Db): Promise<Record<ContentKind, number>> {
  const rows = await db.select({ kind: contentItems.kind, n: count() }).from(contentItems).groupBy(contentItems.kind);
  const out: Record<ContentKind, number> = { guide: 0, experience: 0, service: 0 };
  for (const r of rows) out[r.kind] = r.n;
  return out;
}

export async function listSubscribers(db: Db, limit = 200) {
  return db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(limit);
}

export async function listContentAdmin(db: Db, kind: ContentKind, q?: string): Promise<ContentItem[]> {
  const rows = await db.select().from(contentItems).where(eq(contentItems.kind, kind)).orderBy(asc(contentItems.sortOrder), asc(contentItems.id));
  if (!q) return rows;
  const needle = q.toLowerCase();
  return rows.filter((r) => [r.slug, r.title.en, r.title.uz, r.title.ru, r.category ?? ""].some((s) => s.toLowerCase().includes(needle)));
}

export async function deleteSubscriber(db: Db, id: number): Promise<void> {
  await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
}

export async function subscriberCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(newsletterSubscribers);
  return row?.n ?? 0;
}
