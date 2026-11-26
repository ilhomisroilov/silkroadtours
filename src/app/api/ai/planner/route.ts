import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, getEnv } from "@/db/client";
import { aiConversations, aiMessages, savedTripPlans } from "@/db/schema";
import { detectLanguage, getAiSettings, overRateLimit, runAgent } from "@/lib/ai/agent";
import { cataloguePlan, parsePlan, verifyPlanTours } from "@/lib/ai/planner";
import { hashIp } from "@/lib/crypto";
import { clientIp, ok, parseBody, route, tooManyRequests } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const schema = z.object({
  request: z.string().trim().min(5).max(1500),
  locale: z.enum(["en", "uz", "ru"]).default("en"),
  days: z.number().int().min(1).max(21).optional(),
  budgetUsd: z.number().int().min(50).max(50000).optional(),
  destinations: z.array(z.string().max(40)).max(8).optional(),
  styles: z.array(z.string().max(30)).max(8).optional(),
});

const rid = (p: string) => p + crypto.getRandomValues(new Uint8Array(12)).reduce((s, b) => s + (b % 36).toString(36), "").slice(0, 16).padEnd(16, "0");

/** POST /api/ai/planner — builds a day-by-day plan from the visitor's description and our catalogue, and saves it under a shareable id. */
export const POST = route(async (req) => {
  const input = await parseBody(req, schema);
  const db = getDb();
  const s = await getAiSettings(db);
  const ipHash = await hashIp(clientIp(req), getEnv().SESSION_SECRET || "dev");
  if (await overRateLimit(db, ipHash, Math.max(2, Math.floor(s.perMinuteLimit / 2)))) throw tooManyRequests("ai_rate_limited");

  const language = detectLanguage(input.request, input.locale);
  const daysMatch = input.request.match(/(\d{1,2})\s*(?:-?\s*)(?:days?|kun|дн|день|дня|дней)/i);
  const days = input.days ?? (daysMatch ? Math.min(21, Math.max(1, Number(daysMatch[1]))) : 5);
  const budgetMatch = input.request.match(/\$\s?(\d{2,6})|(\d{2,6})\s?(?:\$|usd|dollar|доллар)/i);
  const budgetUsd = input.budgetUsd ?? (budgetMatch ? Number(budgetMatch[1] || budgetMatch[2]) : undefined);
  const constraints = [
    `Trip length: ${days} days.`,
    budgetUsd ? `Budget: about $${budgetUsd} per person (excluding international flights).` : "",
    input.destinations?.length ? `Must include: ${input.destinations.join(", ")}.` : "",
    input.styles?.length ? `Travel style: ${input.styles.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  const conversationId = rid("c_");
  await db.insert(aiConversations).values({ id: conversationId, locale: language, source: "planner", ipHash, messageCount: 2 });
  const userText = `${input.request}\n\n${constraints}`;
  await db.insert(aiMessages).values({ conversationId, role: "user", content: userText });

  const reply = await runAgent({ db, conversationId, history: [{ role: "user", content: userText }], locale: language, page: "/planner", mode: "planner", settings: s });
  let plan = reply.status === "ok" ? parsePlan(reply.text) : null;
  if (plan) plan = await verifyPlanTours(db, language, plan);
  else {
    plan = await cataloguePlan(db, language, input.request, days, budgetUsd);
    if (reply.status === "ok") await db.update(aiMessages).set({ status: "error", error: "planner_json_parse_failed" }).where(eq(aiMessages.id, reply.messageId ?? -1));
  }
  const id = rid("p_");
  await db.insert(savedTripPlans).values({ id, conversationId, locale: language, request: input.request, plan });
  return ok({ id, plan, days, budgetUsd: budgetUsd ?? null, language }, { headers: { "cache-control": "no-store" } });
});
