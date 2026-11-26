import "server-only";
import { enforceSafeReply, relativizeSiteLinks } from "./guard";
import { and, count, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiConversations, aiMessages, settings } from "@/db/schema";
import type { Locale } from "@/db/types";
import { ProviderError, providerChain, type ChatTurn } from "./providers";
import { executeTool, fallbackSearch, TOOL_SPECS, type ToolContext } from "./tools";

export interface AiSettings {
  assistantName: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  perMinuteLimit: number;
  retentionDays: number;
  enabled: boolean;
  welcome: Record<Locale, string>;
  /** Editable by owners: tone and recommendation rules appended after the protected core rules. */
  extraInstructions: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  assistantName: "National Tours assistant",
  temperature: 0.4,
  maxOutputTokens: 900,
  timeoutMs: 20000,
  perMinuteLimit: 12,
  retentionDays: 90,
  enabled: true,
  welcome: {
    en: "Hello! I'm the National Tours travel assistant. Tell me what kind of journey you are planning, and I'll help you discover Uzbekistan.",
    uz: "Assalomu alaykum! Men National Tours sayohat yordamchisiman. Qanday sayohat rejalashtiryapsiz? Oʻzbekistonni kashf qilishda yordam beraman.",
    ru: "Здравствуйте! Я ваш помощник по путешествиям National Tours. Расскажите, какую поездку вы планируете, и я помогу открыть Узбекистан.",
  },
  extraInstructions: "",
};

export async function getAiSettings(db: Db): Promise<AiSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "ai")).limit(1);
  return { ...DEFAULT_AI_SETTINGS, ...((row?.value as Partial<AiSettings>) ?? {}) };
}

/** Cheap language detection so the reply follows the visitor's language, not only the page locale. */
export function detectLanguage(text: string, fallback: Locale): Locale {
  if (/[Ѐ-ӿ]/.test(text)) return /[ўқғҳ]/i.test(text) ? "uz" : "ru";
  const t = text.toLowerCase();
  const uzHits = ["oʻ", "o'", "gʻ", "g'", "qayer", "kunlik", "sayohat", "menda", "qancha", "nima", "bormoq", "borsam", "uchun", "rejasini", "tuz", "solishtir", "kerak", "bilan", "yaxshi", "dollar bor"].filter((w) => t.includes(w)).length;
  if (uzHits >= 2) return "uz";
  if (/\b(the|what|which|how|where|have|days?|tour|want|can)\b/.test(t)) return "en";
  return fallback;
}

const LANG_NAME: Record<Locale, string> = { en: "English", uz: "Uzbek (Latin script, natural modern Uzbek)", ru: "Russian" };

/** Protected core rules. Owners can append tone/extra rules, but cannot remove these. */
export function systemPrompt(s: AiSettings, lang: Locale, page: string | null, mode: "chat" | "planner"): string {
  return [
    `You are "${s.assistantName}", the in-house travel consultant of National Tours, a tour company in Uzbekistan. You help visitors discover Uzbekistan and Central Asia, choose tours from OUR catalogue, plan realistic itineraries, estimate budgets and send booking requests.`,
    `Reply in ${LANG_NAME[lang]}. Be warm, concise and practical (short paragraphs or bullet points, max ~180 words unless planning a trip).`,
    "CORE RULES (never break):",
    "1. For anything about our tours, prices, durations, routes, itineraries, departures or destinations, call the tools first and base the answer on their results. For practical travel questions (money, SIM cards, food, etiquette, seasons, packing, experiences, transfers, guides) call search_site_content and answer from those passages, linking the page. Prefer company data over general knowledge.",
    "2. Never invent tours, availability, seats, prices or booking status. Prices from tools are INDICATIVE 'from' prices per person; say so. Only the company confirms a final price in writing.",
    "3. Never claim a booking or reservation is confirmed. To help someone book, call prepare_booking_inquiry; this only prepares a draft that the visitor reviews and sends on the booking form. Ask for their confirmation of tour, date and number of travellers first if they are unclear.",
    "4. When you mention a tour or destination, link it with its url from the tool results using Markdown [Title](url), keeping the url exactly as given (a relative path such as /uz/tours/slug, never with a domain added). Do not make up URLs.",
    "5. If information is missing, say so plainly and offer the contact page or a tailor-made request.",
    "6. Visa, border, health and safety rules change: give the general picture and tell the visitor to verify with official sources (e.g. the e-visa portal or their embassy). Do not state those as facts the company guarantees.",
    "7. Itineraries must be realistic: Tashkent–Samarkand ~2h10 by Afrosiyob train, Samarkand–Bukhara ~1h40 train, Bukhara–Khiva ~6–7h by road or overnight train, Tashkent–Fergana valley ~4–5h by road/train, Tashkent–Urgench (for Khiva) ~1h40 flight. Do not put more than one long transfer in a day.",
    "8. Never ask for or repeat passwords, card numbers or ID numbers. Do not ask for personal details in chat; the booking form collects them.",
    "9. Stay on travel topics related to Uzbekistan/Central Asia and National Tours. Politely decline unrelated tasks.",
    page ? `The visitor is currently on page: ${page}. Use it as context (e.g. 'this tour').` : "",
    mode === "planner"
      ? `PLANNER MODE: Use the tools (search_tours, get_tour_details, search_destinations, calculate_trip_budget) and answer ONLY with a JSON object: {"title":string,"summary":string,"days":[{"day":number,"place":string,"title":string,"plan":string,"transport":string|null,"tourSlug":string|null}],"destinations":[string slugs],"suggestedTours":[{"slug":string,"title":string,"why":string}],"budget":{"low":number,"high":number,"currency":"USD","note":string},"accommodation":string,"transport":string,"bestSeason":string,"food":[string],"tips":[string]}. Every tourSlug must come from tool results. Write all text values in ${LANG_NAME[lang]}.`
      : "",
    s.extraInstructions ? `Company style notes (lower priority than the core rules): ${s.extraInstructions.slice(0, 2000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function overRateLimit(db: Db, ipHash: string, perMinute: number): Promise<boolean> {
  const since = new Date(Date.now() - 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(aiMessages)
    .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
    .where(and(eq(aiConversations.ipHash, ipHash), eq(aiMessages.role, "user"), gt(aiMessages.createdAt, since)));
  return (row?.n ?? 0) >= perMinute;
}

export interface AgentReply {
  conversationId: string;
  text: string;
  status: "ok" | "fallback";
  provider: string | null;
  cards: { kind: "tour" | "destination"; slug: string; title: string; url: string; image: string; meta: string }[];
  bookingDraft: ToolContext["bookingDraft"] | null;
  language: Locale;
  messageId: number | null;
}

const FALLBACK_TEXT: Record<Locale, string> = {
  en: "Our AI assistant is unavailable right now, so here are matching tours from our catalogue. You can also book directly or message our team.",
  uz: "AI yordamchi hozir ishlamayapti, shuning uchun katalogimizdan mos turlarni ko‘rsatyapman. To‘g‘ridan-to‘g‘ri bron so‘rovi yuborishingiz yoki jamoamizga yozishingiz mumkin.",
  ru: "ИИ-помощник сейчас недоступен, поэтому показываю подходящие туры из каталога. Вы также можете отправить заявку напрямую или написать нашей команде.",
};

export async function runAgent(opts: {
  db: Db;
  conversationId: string;
  history: ChatTurn[];
  locale: Locale;
  page: string | null;
  mode: "chat" | "planner";
  settings: AiSettings;
}): Promise<AgentReply> {
  const { db, conversationId, history, page, mode, settings: s } = opts;
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const language = detectLanguage(lastUser, opts.locale);
  const ctx: ToolContext = { db, locale: language, conversationId, sources: new Set(), cards: new Map() };
  const chain = s.enabled ? providerChain() : [];
  const started = Date.now();
  let lastError: string | null = null;

  for (const adapter of chain) {
    try {
      const res = await adapter.run({
        system: systemPrompt(s, language, page, mode),
        history: history.slice(-12),
        tools: TOOL_SPECS,
        execute: (name, args) => executeTool(ctx, name, args),
        temperature: s.temperature,
        maxOutputTokens: mode === "planner" ? Math.max(s.maxOutputTokens, 2500) : s.maxOutputTokens,
        timeoutMs: mode === "planner" ? Math.max(s.timeoutMs, 45000) : s.timeoutMs,
        json: mode === "planner",
      });
      if (!res.text) throw new ProviderError(adapter.id, "bad_response", "empty answer");
      // Second line of defence: never let a reply claim a confirmed booking, guaranteed seats or ask for payment.
      if (mode === "chat") {
        res.text = relativizeSiteLinks(res.text);
        const safe = enforceSafeReply(res.text, language);
        if (safe.flagged.length) {
          res.text = safe.text;
          lastError = `guard:${safe.flagged.join(",")}`;
        }
      }
      const unanswered = ctx.sources.size === 0 && /not (have|find)|нет информации|ma'lumot yo|maʼlumot yo|topa olmadim/i.test(res.text);
      const [msg] = await db
        .insert(aiMessages)
        .values({
          conversationId,
          role: "assistant",
          content: res.text.slice(0, 20000),
          sources: [...ctx.sources],
          provider: res.provider,
          model: res.model,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          latencyMs: Date.now() - started,
          status: unanswered ? "unanswered" : "ok",
          error: lastError,
        })
        .returning({ id: aiMessages.id });
      return { conversationId, text: res.text, status: "ok", provider: res.provider, cards: [...ctx.cards.values()].slice(0, 6), bookingDraft: ctx.bookingDraft ?? null, language, messageId: msg?.id ?? null };
    } catch (err) {
      lastError = err instanceof ProviderError ? `${err.provider}:${err.kind}:${err.message.slice(0, 200)}` : String(err).slice(0, 200);
      console.error("[ai]", lastError);
    }
  }

  // Non-AI fallback: database search so the visitor still gets useful, real results.
  const found = await fallbackSearch(ctx, lastUser);
  const text = FALLBACK_TEXT[language];
  const [msg] = await db
    .insert(aiMessages)
    .values({ conversationId, role: "assistant", content: text, sources: [...ctx.sources], latencyMs: Date.now() - started, status: chain.length ? "error" : "fallback", error: lastError ?? (chain.length ? null : "no_provider_configured") })
    .returning({ id: aiMessages.id });
  return { conversationId, text, status: "fallback", provider: null, cards: (found.tours ?? []).length ? [...ctx.cards.values()].slice(0, 4) : [], bookingDraft: null, language, messageId: msg?.id ?? null };
}
