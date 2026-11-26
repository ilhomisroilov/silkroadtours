import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiConversations, aiFeedback, aiMessages, aiToolLogs, contentItems, destinations, faqItems, places, tours } from "@/db/schema";
import { adapterFor, providerChain } from "./providers";

export const AI_KEY_ENVS = ["GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "CEREBRAS_API_KEY", "GROQ_API_KEY", "AI_COMPAT_API_KEY"] as const;

/** Providers the AI layer knows, with the env var that holds each key. */
const PROVIDERS = [
  { id: "gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL" },
  { id: "mistral", keyEnv: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL" },
  { id: "openrouter", keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL" },
  { id: "cerebras", keyEnv: "CEREBRAS_API_KEY", modelEnv: "CEREBRAS_MODEL" },
  { id: "groq", keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL" },
  { id: "custom", keyEnv: "AI_COMPAT_API_KEY", modelEnv: "AI_COMPAT_MODEL" },
] as const;

/** Never returns key material: only whether a key is set and its last 4 characters. */
const mask = (v: string | undefined) => (v ? `••••${v.slice(-4)}` : null);
const env = (k: string) => process.env[k]?.trim() || undefined;

export type ProviderRole = "primary" | "secondary" | "fallback";

/** Provider status for the admin (keys masked). `chain` is the exact order the agent tries. */
export function providerStatus() {
  const chain = providerChain();
  const primaryId = chain[0]?.id;
  const chainRows = chain.map((p, i) => ({
    id: p.id,
    model: p.model,
    role: (i === 0 ? "primary" : p.id === primaryId ? "secondary" : "fallback") as ProviderRole,
  }));
  const providers = PROVIDERS.map((p) => {
    const position = chainRows.findIndex((c) => c.id === p.id);
    let model: string | null = null;
    try {
      model = adapterFor(p.id)?.model || null;
    } catch {
      model = null;
    }
    return {
      id: p.id,
      keyEnv: p.keyEnv,
      key: mask(env(p.keyEnv)),
      model,
      modelFromEnv: Boolean(env(p.modelEnv)),
      inChain: position >= 0,
      position: position >= 0 ? position + 1 : null,
      role: position >= 0 ? chainRows[position]!.role : null,
    };
  });
  let customHost: string | null = null;
  try {
    customHost = env("AI_COMPAT_BASE_URL") ? new URL(env("AI_COMPAT_BASE_URL")!).host : null;
  } catch {
    customHost = null;
  }
  return {
    chain: chainRows,
    providers,
    keys: AI_KEY_ENVS.map((name) => ({ name, value: mask(env(name)) })),
    primary: env("AI_PROVIDER") || "gemini",
    config: {
      AI_PROVIDER: env("AI_PROVIDER") ?? null,
      AI_MODEL: env("AI_MODEL") ?? null,
      AI_SECONDARY_MODEL: env("AI_SECONDARY_MODEL") ?? null,
      AI_FALLBACK_PROVIDER: env("AI_FALLBACK_PROVIDER") ?? null,
      AI_FALLBACK_MODEL: env("AI_FALLBACK_MODEL") ?? null,
      AI_COMPAT_BASE_URL: customHost,
    },
  };
}
export type ProviderStatus = ReturnType<typeof providerStatus>;

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

// Correlated subqueries need table-qualified outer columns (drizzle renders bare "id" in single-table selects).
const CONV_ID = sql.raw(`"ai_conversations"."id"`);
const MSG_ID = sql.raw(`"ai_messages"."id"`);
const MSG_CONV = sql.raw(`"ai_messages"."conversation_id"`);

/** Admin test-console conversations are tagged with this page value. */
export const TEST_CONSOLE_PAGE = "admin:test-console";

export async function aiStats(db: Db, days = 30) {
  const from = since(days);
  const [conv] = await db.select({ n: sql<number>`count(*)` }).from(aiConversations).where(gte(aiConversations.createdAt, from));
  const byStatus = await db
    .select({ status: aiMessages.status, n: sql<number>`count(*)`, tin: sql<number>`coalesce(sum(${aiMessages.tokensIn}),0)`, tout: sql<number>`coalesce(sum(${aiMessages.tokensOut}),0)`, lat: sql<number>`coalesce(avg(${aiMessages.latencyMs}),0)` })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, from)))
    .groupBy(aiMessages.status);
  const byProvider = await db
    .select({ provider: aiMessages.provider, model: aiMessages.model, n: sql<number>`count(*)` })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, from)))
    .groupBy(aiMessages.provider, aiMessages.model);
  const tools = await db
    .select({ tool: aiToolLogs.tool, n: sql<number>`count(*)`, failed: sql<number>`sum(case when ${aiToolLogs.ok} = 0 then 1 else 0 end)` })
    .from(aiToolLogs)
    .where(gte(aiToolLogs.createdAt, from))
    .groupBy(aiToolLogs.tool)
    .orderBy(desc(sql`count(*)`));
  const fb = await db.select({ rating: aiFeedback.rating, n: sql<number>`count(*)` }).from(aiFeedback).where(gte(aiFeedback.createdAt, from)).groupBy(aiFeedback.rating);
  const [bookings] = await db
    .select({ n: sql<number>`count(*)` })
    .from(aiConversations)
    .where(and(gte(aiConversations.createdAt, from), sql`${aiConversations.bookingReference} is not null`));
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
    byProvider: byProvider.map((r) => ({ label: `${r.provider ?? "catalogue"} · ${r.model ?? "—"}`, value: Number(r.n) })),
    tools: tools.map((r) => ({ label: r.tool, value: Number(r.n), failed: Number(r.failed ?? 0) })),
    feedback: { up: Number(fb.find((r) => r.rating === 1)?.n ?? 0), down: Number(fb.find((r) => r.rating === -1)?.n ?? 0) },
    bookingInquiries: Number(bookings?.n ?? 0),
  };
}

/** What the assistant can look up: real row counts (published / total). */
export async function knowledgeStats(db: Db) {
  const pub = (col: SQLWrapper) => sql<number>`coalesce(sum(case when ${col} = 1 then 1 else 0 end),0)`;
  const [t] = await db.select({ all: count(), pub: pub(tours.isPublished) }).from(tours);
  const destRows = await db.select({ isPublished: destinations.isPublished, attractions: destinations.attractions }).from(destinations);
  const [f] = await db.select({ all: count(), pub: pub(faqItems.isPublished) }).from(faqItems);
  const content = await db.select({ kind: contentItems.kind, all: count(), pub: pub(contentItems.isPublished) }).from(contentItems).groupBy(contentItems.kind);
  const placeRows = await db.select({ kind: places.kind, all: count(), pub: pub(places.isPublished) }).from(places).groupBy(places.kind);
  const pubDest = destRows.filter((d) => d.isPublished);
  const attractions = pubDest.reduce((s, d) => s + (d.attractions?.length ?? 0), 0);
  const attractionsMapped = pubDest.reduce((s, d) => s + (d.attractions ?? []).filter((a) => a.lat != null && a.lng != null).length, 0);
  const c = (k: string) => content.find((r) => r.kind === k);
  const p = (k: string) => placeRows.find((r) => r.kind === k);
  const pair = (r: { all: number; pub: number } | undefined) => ({ published: Number(r?.pub ?? 0), total: Number(r?.all ?? 0) });
  return {
    tours: pair(t),
    destinations: { published: pubDest.length, total: destRows.length },
    attractions: { published: attractions, total: attractions, mapped: attractionsMapped },
    guides: pair(c("guide")),
    experiences: pair(c("experience")),
    services: pair(c("service")),
    hotels: pair(p("hotel")),
    restaurants: pair(p("restaurant")),
    transport: pair(p("transport")),
    faq: pair(f),
  };
}

/** Day key in Tashkent time (UTC+5), e.g. "2026-11-26". */
const DAY = sql<string>`strftime('%Y-%m-%d', ${aiMessages.createdAt} + 18000, 'unixepoch')`;

/** Requests per day (visitor messages) and replies per day by outcome, plus per-provider latency. */
export async function usageStats(db: Db, days = 30) {
  const from = since(days);
  const perDay = await db
    .select({ day: DAY, role: aiMessages.role, status: aiMessages.status, n: sql<number>`count(*)` })
    .from(aiMessages)
    .where(gte(aiMessages.createdAt, from))
    .groupBy(DAY, aiMessages.role, aiMessages.status);
  const map = new Map<string, { requests: number; ok: number; failed: number }>();
  for (const r of perDay) {
    const row = map.get(r.day) ?? { requests: 0, ok: 0, failed: 0 };
    if (r.role === "user") row.requests += Number(r.n);
    else if (r.status === "ok" || r.status === "unanswered") row.ok += Number(r.n);
    else row.failed += Number(r.n);
    map.set(r.day, row);
  }
  const series: { day: string; requests: number; ok: number; failed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 5 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day: d, ...(map.get(d) ?? { requests: 0, ok: 0, failed: 0 }) });
  }
  const providers = await db
    .select({
      provider: aiMessages.provider,
      model: aiMessages.model,
      n: sql<number>`count(*)`,
      lat: sql<number>`coalesce(avg(${aiMessages.latencyMs}),0)`,
      tin: sql<number>`coalesce(sum(${aiMessages.tokensIn}),0)`,
      tout: sql<number>`coalesce(sum(${aiMessages.tokensOut}),0)`,
      last: sql<number>`max(${aiMessages.createdAt})`,
    })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, from), isNotNull(aiMessages.provider)))
    .groupBy(aiMessages.provider, aiMessages.model)
    .orderBy(desc(sql`count(*)`));
  return {
    series,
    providers: providers.map((r) => ({ provider: r.provider ?? "", model: r.model ?? "", replies: Number(r.n), avgLatencyMs: Math.round(Number(r.lat)), tokensIn: Number(r.tin), tokensOut: Number(r.tout), lastAt: r.last ? new Date(Number(r.last) * 1000) : null })),
  };
}

/** Replies that failed over to the catalogue search, errored, or were rewritten by the safety guard. */
export async function failedRequests(db: Db, days = 30, limit = 60) {
  const from = since(days);
  const rows = await db
    .select({
      id: aiMessages.id,
      conversationId: aiMessages.conversationId,
      status: aiMessages.status,
      provider: aiMessages.provider,
      model: aiMessages.model,
      error: aiMessages.error,
      latencyMs: aiMessages.latencyMs,
      createdAt: aiMessages.createdAt,
      question: sql<string | null>`(select content from ai_messages u where u.conversation_id = ${MSG_CONV} and u.role = 'user' and u.id < ${MSG_ID} order by u.id desc limit 1)`,
      page: sql<string | null>`(select page from ai_conversations c where c.id = ${MSG_CONV})`,
    })
    .from(aiMessages)
    .where(and(eq(aiMessages.role, "assistant"), gte(aiMessages.createdAt, from), or(inArray(aiMessages.status, ["error", "fallback"]), isNotNull(aiMessages.error))))
    .orderBy(desc(aiMessages.id))
    .limit(limit);
  // Group by "provider:kind" (errors are stored as provider:kind:message by the agent).
  const groups = new Map<string, number>();
  for (const r of rows) {
    const key = r.error ? r.error.split(":").slice(0, 2).join(":") : r.status;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [toolFails] = await db.select({ n: count() }).from(aiToolLogs).where(and(gte(aiToolLogs.createdAt, from), eq(aiToolLogs.ok, false)));
  return {
    rows: rows.map((r) => ({ ...r, isTest: r.page === TEST_CONSOLE_PAGE })),
    groups: [...groups.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    toolFailures: Number(toolFails?.n ?? 0),
  };
}

export interface ConversationFilter {
  status?: "ok" | "error" | "fallback" | "unanswered";
  source?: "assistant" | "planner" | "test";
  locale?: "en" | "uz" | "ru";
  q?: string;
  page?: number;
  pageSize?: number;
}

const LAST_STATUS = sql<string>`(select status from ai_messages m where m.conversation_id = ${CONV_ID} and m.role = 'assistant' order by m.id desc limit 1)`;

export async function recentConversations(db: Db, limitOrFilter: number | ConversationFilter = 50) {
  const f: ConversationFilter = typeof limitOrFilter === "number" ? { pageSize: limitOrFilter } : limitOrFilter;
  const pageSize = f.pageSize ?? 30;
  const page = Math.max(1, f.page ?? 1);
  const conds: SQL[] = [];
  if (f.status) conds.push(sql`${LAST_STATUS} = ${f.status}`);
  if (f.source === "test") conds.push(eq(aiConversations.page, TEST_CONSOLE_PAGE));
  else if (f.source) conds.push(and(eq(aiConversations.source, f.source), sql`coalesce(${aiConversations.page}, '') != ${TEST_CONSOLE_PAGE}`)!);
  if (f.locale) conds.push(eq(aiConversations.locale, f.locale));
  if (f.q?.trim()) conds.push(sql`exists (select 1 from ai_messages s where s.conversation_id = ${CONV_ID} and s.content like ${`%${f.q.trim()}%`})`);
  const where = conds.length ? and(...conds) : undefined;
  const [total] = await db.select({ n: count() }).from(aiConversations).where(where);
  const rows = await db
    .select({
      id: aiConversations.id,
      locale: aiConversations.locale,
      source: aiConversations.source,
      page: aiConversations.page,
      messageCount: aiConversations.messageCount,
      bookingReference: aiConversations.bookingReference,
      createdAt: aiConversations.createdAt,
      updatedAt: aiConversations.updatedAt,
      firstQuestion: sql<string>`(select content from ai_messages m where m.conversation_id = ${CONV_ID} and m.role = 'user' order by m.id limit 1)`,
      lastStatus: LAST_STATUS,
      lastProvider: sql<string>`(select coalesce(provider,'catalogue') from ai_messages m where m.conversation_id = ${CONV_ID} and m.role = 'assistant' order by m.id desc limit 1)`,
      tokens: sql<number>`(select coalesce(sum(coalesce(tokens_in,0)+coalesce(tokens_out,0)),0) from ai_messages m where m.conversation_id = ${CONV_ID})`,
      rating: sql<number | null>`(select sum(f.rating) from ai_feedback f join ai_messages m on m.id = f.message_id where m.conversation_id = ${CONV_ID})`,
    })
    .from(aiConversations)
    .where(where)
    .orderBy(desc(aiConversations.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return Object.assign(
    rows.map((r) => ({ ...r, isTest: r.page === TEST_CONSOLE_PAGE })),
    { total: Number(total?.n ?? 0), page, pageSize },
  );
}

export async function conversationDetail(db: Db, id: string) {
  const [conv] = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  if (!conv) return null;
  const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(aiMessages.id);
  const toolLogs = await db.select().from(aiToolLogs).where(eq(aiToolLogs.conversationId, id)).orderBy(aiToolLogs.id);
  const ratings = messages.length
    ? await db.select({ messageId: aiFeedback.messageId, rating: aiFeedback.rating }).from(aiFeedback).where(inArray(aiFeedback.messageId, messages.map((m) => m.id)))
    : [];
  return { conv, messages, toolLogs, ratings, isTest: conv.page === TEST_CONSOLE_PAGE };
}
