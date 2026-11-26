import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { aiConversations, aiMessages, aiToolLogs } from "@/db/schema";
import { providerStatus, TEST_CONSOLE_PAGE } from "@/lib/ai/admin";
import { getAiSettings, runAgent } from "@/lib/ai/agent";
import { requireAdmin } from "@/lib/auth/guard";
import { ok, parseBody, route } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(1500),
  locale: z.enum(["en", "uz", "ru"]).default("en"),
  /** Continue an earlier test conversation (only test-console conversations can be continued). */
  conversationId: z.string().regex(/^c_[a-z0-9]{16}$/).optional(),
});

const newId = () => "c_" + crypto.getRandomValues(new Uint8Array(12)).reduce((s, b) => s + (b % 36).toString(36), "").slice(0, 16).padEnd(16, "0");

/**
 * POST /api/admin/ai/test — admin test console. Runs the same agent as the public assistant
 * (runAgent in chat mode, same settings and provider chain) without the visitor rate limit, and
 * returns the reply with provider, model, latency, tokens, tool calls and errors. Admin session +
 * same-origin required. Test conversations are stored like real ones, tagged page="admin:test-console".
 */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseBody(req, bodySchema);
  const db = getDb();
  const settings = await getAiSettings(db);

  let conversationId = input.conversationId;
  if (conversationId) {
    const [c] = await db.select({ id: aiConversations.id, page: aiConversations.page }).from(aiConversations).where(eq(aiConversations.id, conversationId)).limit(1);
    if (!c || c.page !== TEST_CONSOLE_PAGE) conversationId = undefined;
  }
  if (!conversationId) {
    conversationId = newId();
    await db.insert(aiConversations).values({ id: conversationId, locale: input.locale, page: TEST_CONSOLE_PAGE, consent: false, ipHash: `admin:${admin.id}`, source: "assistant" });
  }
  // Same redaction as the public endpoint, so the test reflects what the model really receives.
  const message = input.prompt
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[phone]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[number]");
  const [userMsg] = await db.insert(aiMessages).values({ conversationId, role: "user", content: message }).returning({ id: aiMessages.id });
  await db
    .update(aiConversations)
    .set({ messageCount: sql`${aiConversations.messageCount} + 2`, updatedAt: new Date(), locale: input.locale })
    .where(eq(aiConversations.id, conversationId));
  const [lastTool] = await db.select({ id: sql<number>`coalesce(max(${aiToolLogs.id}), 0)` }).from(aiToolLogs);
  const history = await db.select({ role: aiMessages.role, content: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.id));

  const started = Date.now();
  const chain = providerStatus().chain;
  let reply: Awaited<ReturnType<typeof runAgent>> | null = null;
  let crash: string | null = null;
  try {
    reply = await runAgent({ db, conversationId, history: history.slice(-12), locale: input.locale, page: null, mode: "chat", settings });
  } catch (err) {
    crash = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    console.error("[ai test]", crash);
  }
  const elapsedMs = Date.now() - started;

  const [stored] = reply?.messageId ? await db.select().from(aiMessages).where(eq(aiMessages.id, reply.messageId)).limit(1) : [];
  const tools = await db
    .select({ tool: aiToolLogs.tool, input: aiToolLogs.input, ok: aiToolLogs.ok, resultCount: aiToolLogs.resultCount })
    .from(aiToolLogs)
    .where(and(eq(aiToolLogs.conversationId, conversationId), gt(aiToolLogs.id, Number(lastTool?.id ?? 0))))
    .orderBy(asc(aiToolLogs.id));
  await logAdminAction(db, admin, "test", "ai", conversationId, `user message ${userMsg?.id ?? "?"}`);

  return ok(
    {
      conversationId,
      enabled: settings.enabled,
      chain,
      text: reply?.text ?? null,
      /** "ok" = a model answered; "fallback" = no model answered and the catalogue search replied; "failed" = the agent itself crashed. */
      outcome: crash ? "failed" : reply?.status === "ok" ? "ok" : "fallback",
      storedStatus: stored?.status ?? null,
      provider: stored?.provider ?? reply?.provider ?? null,
      model: stored?.model ?? null,
      latencyMs: stored?.latencyMs ?? elapsedMs,
      elapsedMs,
      tokensIn: stored?.tokensIn ?? null,
      tokensOut: stored?.tokensOut ?? null,
      error: crash ?? stored?.error ?? null,
      sources: stored?.sources ?? [],
      language: reply?.language ?? input.locale,
      cards: reply?.cards ?? [],
      bookingDraft: reply?.bookingDraft ?? null,
      toolCalls: tools.map((t) => ({ tool: t.tool, input: t.input, ok: t.ok, resultCount: t.resultCount })),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
