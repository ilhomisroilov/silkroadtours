import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiConversations, aiFeedback, aiMessages, aiToolLogs, destinations, faqItems, tours } from "@/db/schema";
import { providerChain } from "./providers";

export const AI_KEY_ENVS = ["GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "CEREBRAS_API_KEY", "GROQ_API_KEY", "AI_COMPAT_API_KEY"] as const;

/** Provider status for the admin: never returns key material, only whether a key is set and its last 4 characters. */
export function providerStatus() {
  const mask = (v: string | undefined) => (v ? `••••${v.slice(-4)}` : null);
  return {
    chain: providerChain().map((p) => ({ id: p.id, model: p.model })),
    keys: AI_KEY_ENVS.map((name) => ({ name, value: mask(process.env[name]?.trim() || undefined) })),
    primary: process.env.AI_PROVIDER || "gemini",
  };
}

export async function aiStats(db: Db, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [conv] = await db.select({ n: sql<number>`count(*)` }).from(aiConversations).where(gte(aiConversations.createdAt, since));
  const byStatus = await db
    .select({ status: aiMessages.status, n: sql<number>`count(*)`, tin: sql<number>`coalesce(sum(${aiMessages.tokensIn}),0)`, tout: sql<number>`coalesce(sum(${aiMessages.tokensOut}),0)`, lat: sql<number>`coalesce(avg(${aiMessages.latencyMs}),0)` })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, since)))
    .groupBy(aiMessages.status);
  const byProvider = await db
    .select({ provider: aiMessages.provider, model: aiMessages.model, n: sql<number>`count(*)` })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, since)))
    .groupBy(aiMessages.provider, aiMessages.model);
  const tools = await db
    .select({ tool: aiToolLogs.tool, n: sql<number>`count(*)` })
    .from(aiToolLogs)
    .where(gte(aiToolLogs.createdAt, since))
    .groupBy(aiToolLogs.tool)
    .orderBy(desc(sql`count(*)`));
  const fb = await db.select({ rating: aiFeedback.rating, n: sql<number>`count(*)` }).from(aiFeedback).groupBy(aiFeedback.rating);
  const [bookings] = await db
    .select({ n: sql<number>`count(*)` })
    .from(aiConversations)
    .where(and(gte(aiConversations.createdAt, since), sql`${aiConversations.bookingReference} is not null`));
  const total = byStatus.reduce((s, r) => s + Number(r.n), 0);
  const get = (s: string) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
  return {
    days,
    conversations: Number(conv?.n ?? 0),
    replies: total,
    ok: get("ok"),
    fallback: get("fallback"),
    errors: get("error"),
    unanswered: get("unanswered"),
    tokensIn: byStatus.reduce((s, r) => s + Number(r.tin), 0),
    tokensOut: byStatus.reduce((s, r) => s + Number(r.tout), 0),
    avgLatencyMs: total ? Math.round(byStatus.reduce((s, r) => s + Number(r.lat) * Number(r.n), 0) / total) : 0,
    byProvider: byProvider.map((r) => ({ label: `${r.provider ?? "db"} · ${r.model ?? "—"}`, value: Number(r.n) })),
    tools: tools.map((r) => ({ label: r.tool, value: Number(r.n) })),
    feedback: { up: Number(fb.find((r) => r.rating === 1)?.n ?? 0), down: Number(fb.find((r) => r.rating === -1)?.n ?? 0) },
    bookingInquiries: Number(bookings?.n ?? 0),
  };
}

export async function knowledgeStats(db: Db) {
  const [t] = await db.select({ all: sql<number>`count(*)`, pub: sql<number>`sum(case when ${tours.isPublished} = 1 then 1 else 0 end)` }).from(tours);
  const [d] = await db.select({ all: sql<number>`count(*)` }).from(destinations);
  const [f] = await db.select({ all: sql<number>`count(*)` }).from(faqItems);
  return { tours: Number(t?.all ?? 0), toursPublished: Number(t?.pub ?? 0), destinations: Number(d?.all ?? 0), faq: Number(f?.all ?? 0) };
}

export async function recentConversations(db: Db, limit = 50) {
  const rows = await db
    .select({
      id: aiConversations.id,
      locale: aiConversations.locale,
      source: aiConversations.source,
      page: aiConversations.page,
      messageCount: aiConversations.messageCount,
      bookingReference: aiConversations.bookingReference,
      createdAt: aiConversations.createdAt,
      firstQuestion: sql<string>`(select content from ai_messages m where m.conversation_id = ${aiConversations.id} and m.role = 'user' order by m.id limit 1)`,
      lastStatus: sql<string>`(select status from ai_messages m where m.conversation_id = ${aiConversations.id} and m.role = 'assistant' order by m.id desc limit 1)`,
      lastProvider: sql<string>`(select coalesce(provider,'db') from ai_messages m where m.conversation_id = ${aiConversations.id} and m.role = 'assistant' order by m.id desc limit 1)`,
      tokens: sql<number>`(select coalesce(sum(coalesce(tokens_in,0)+coalesce(tokens_out,0)),0) from ai_messages m where m.conversation_id = ${aiConversations.id})`,
    })
    .from(aiConversations)
    .orderBy(desc(aiConversations.updatedAt))
    .limit(limit);
  return rows;
}

export async function conversationDetail(db: Db, id: string) {
  const [conv] = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  if (!conv) return null;
  const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(aiMessages.id);
  const toolLogs = await db.select().from(aiToolLogs).where(eq(aiToolLogs.conversationId, id)).orderBy(aiToolLogs.id);
  return { conv, messages, toolLogs };
}
