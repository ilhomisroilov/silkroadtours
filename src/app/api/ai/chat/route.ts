import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, getEnv } from "@/db/client";
import { aiConversations, aiMessages } from "@/db/schema";
import { getAiSettings, overRateLimit, runAgent } from "@/lib/ai/agent";
import { hashIp } from "@/lib/crypto";
import { clientIp, ok, parseBody, route, tooManyRequests } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().regex(/^c_[a-z0-9]{16}$/).optional(),
  message: z.string().trim().min(1).max(1500),
  locale: z.enum(["en", "uz", "ru"]).default("en"),
  page: z.string().max(200).optional(),
  consent: z.boolean().default(false),
});

const newId = () => "c_" + crypto.getRandomValues(new Uint8Array(12)).reduce((s, b) => s + (b % 36).toString(36), "").slice(0, 16).padEnd(16, "0");

/**
 * POST /api/ai/chat — one visitor turn. The API key never leaves the server; the visitor's message
 * is stored without name/email (personal details are collected only by the booking form).
 */
export const POST = route(async (req) => {
  const input = await parseBody(req, bodySchema);
  const db = getDb();
  const s = await getAiSettings(db);
  const ipHash = await hashIp(clientIp(req), getEnv().SESSION_SECRET || "dev");
  if (await overRateLimit(db, ipHash, s.perMinuteLimit)) throw tooManyRequests("ai_rate_limited");

  let conversationId = input.conversationId;
  if (conversationId) {
    const [c] = await db.select({ id: aiConversations.id, ipHash: aiConversations.ipHash }).from(aiConversations).where(eq(aiConversations.id, conversationId)).limit(1);
    if (!c || c.ipHash !== ipHash) conversationId = undefined; // never continue someone else's conversation
  }
  if (!conversationId) {
    conversationId = newId();
    await db.insert(aiConversations).values({ id: conversationId, locale: input.locale, page: input.page ?? null, consent: input.consent, ipHash, source: "assistant" });
  }
  // Redact obvious personal data before it is stored or sent to the model.
  const message = input.message
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[phone]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[number]");
  await db.insert(aiMessages).values({ conversationId, role: "user", content: message });
  await db
    .update(aiConversations)
    .set({ messageCount: sql`${aiConversations.messageCount} + 2`, updatedAt: new Date(), consent: input.consent, page: input.page ?? null })
    .where(eq(aiConversations.id, conversationId));

  const rows = await db.select({ role: aiMessages.role, content: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.id));
  const reply = await runAgent({ db, conversationId, history: rows.slice(-12), locale: input.locale, page: input.page ?? null, mode: "chat", settings: s });
  return ok(reply, { headers: { "cache-control": "no-store" } });
});
