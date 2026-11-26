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
  /** The visitor's trip constructor plan, so the guide can modify it. Catalogue titles only, no personal data. */
  trip: z
    .object({
      title: z.string().max(120).optional(),
      destinations: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(12).default([]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      adults: z.number().int().min(0).max(50).default(2),
      children: z.number().int().min(0).max(50).default(0),
      items: z
        .array(
          z.object({
            kind: z.string().max(20),
            title: z.string().max(140),
            day: z.number().int().min(1).max(60).optional(),
            priceUsd: z.number().min(0).max(100000).optional(),
            priceUnit: z.string().max(10).optional(),
          }),
        )
        .max(40)
        .default([]),
    })
    .optional(),
});

/** Redact obvious personal data before it is stored or sent to the model. */
const redact = (text: string) =>
  text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[phone]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[number]");

type TripInput = NonNullable<z.infer<typeof bodySchema>["trip"]>;

/** One compact line per day for the system prompt. */
function tripSummary(trip: TripInput): string | null {
  if (!trip.items.length && !trip.destinations.length) return null;
  const byDay = new Map<number, string[]>();
  for (const i of trip.items) {
    const price = i.priceUsd != null ? ` ($${i.priceUsd}${i.priceUnit ? `/${i.priceUnit}` : ""})` : "";
    const day = i.day ?? 0;
    byDay.set(day, [...(byDay.get(day) ?? []), `${i.kind}: ${redact(i.title)}${price}`]);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => (a || 999) - (b || 999));
  return [
    trip.destinations.length ? `destinations ${trip.destinations.join(", ")}` : "",
    trip.startDate ? `dates ${trip.startDate}${trip.endDate ? ` to ${trip.endDate}` : ""}` : "",
    `travellers ${trip.adults} adults${trip.children ? `, ${trip.children} children` : ""}`,
    ...days.map(([d, list]) => `${d ? `Day ${d}` : "Not scheduled"}: ${list.join("; ")}`),
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 2500);
}

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
  const message = redact(input.message);
  await db.insert(aiMessages).values({ conversationId, role: "user", content: message });
  await db
    .update(aiConversations)
    .set({ messageCount: sql`${aiConversations.messageCount} + 2`, updatedAt: new Date(), consent: input.consent, page: input.page ?? null })
    .where(eq(aiConversations.id, conversationId));

  const rows = await db.select({ role: aiMessages.role, content: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.id));
  const reply = await runAgent({ db, conversationId, history: rows.slice(-12), locale: input.locale, page: input.page ?? null, mode: "chat", settings: s, trip: input.trip ? tripSummary(input.trip) : null });
  return ok(reply, { headers: { "cache-control": "no-store" } });
});
