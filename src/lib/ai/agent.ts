import "server-only";
import { enforceSafeReply, relativizeSiteLinks } from "./guard";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiConversations, aiMessages, destinations, places, settings, tours } from "@/db/schema";
import type { Locale } from "@/db/types";
import { ProviderError, providerChain, type ChatTurn, type RunInput } from "./providers";
import { uzText } from "@/lib/uz-alphabet";
import { executeTool, fallbackSearch, phrasesAsText, TOOL_SPECS, type AiCard, type FallbackKind, type ToolContext } from "./tools";

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
  assistantName: "Gulistan Travel assistant",
  temperature: 0.4,
  maxOutputTokens: 900,
  timeoutMs: 20000,
  perMinuteLimit: 12,
  retentionDays: 90,
  enabled: true,
  welcome: {
    en: "Hello! I'm the Gulistan Travel travel assistant. Tell me what kind of journey you are planning, and I'll help you discover Uzbekistan.",
    uz: "Assalomu alaykum! Men Gulistan Travel sayohat yordamchisiman. Qanday sayohat rejalashtiryapsiz? Oʻzbekistonni kashf qilishda yordam beraman.",
    ru: "Здравствуйте! Я ваш помощник по путешествиям Gulistan Travel. Расскажите, какую поездку вы планируете, и я помогу открыть Узбекистан.",
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
  const uzHits = ["oʻ", "o'", "gʻ", "g'", "ö", "ğ", "ş", "ç", "qayer", "kunlik", "sayohat", "menda", "qancha", "nima", "bormoq", "borsam", "uchun", "rejasini", "tuz", "solishtir", "kerak", "bilan", "yaxshi", "dollar bor"].filter((w) => t.includes(w)).length;
  if (uzHits >= 2) return "uz";
  if (/\b(the|what|which|how|where|have|days?|tour|want|can)\b/.test(t)) return "en";
  return fallback;
}

const CATALOGUE_LINK = /\[([^\]]+)\]\(\/(?:en|uz|ru)\/(tours|destinations|hotels|restaurants)\/([a-z0-9-]+)\)/g;

/** A link the model wrote to a tour, destination, hotel or restaurant that is not published becomes plain text, so no visitor lands on a missing page. */
export async function unlinkUnknownPages(db: Db, text: string): Promise<string> {
  const wanted: Record<"tours" | "destinations" | "places", Set<string>> = { tours: new Set(), destinations: new Set(), places: new Set() };
  const group = (section: string) => (section === "tours" ? "tours" : section === "destinations" ? "destinations" : "places");
  for (const m of text.matchAll(CATALOGUE_LINK)) wanted[group(m[2]!)].add(m[3]!);
  if (!wanted.tours.size && !wanted.destinations.size && !wanted.places.size) return text;
  const known = new Set<string>();
  const keep = (g: string, rows: { slug: string }[]) => rows.forEach((r) => known.add(`${g}:${r.slug}`));
  if (wanted.tours.size) keep("tours", await db.select({ slug: tours.slug }).from(tours).where(and(inArray(tours.slug, [...wanted.tours]), eq(tours.isPublished, true))));
  if (wanted.destinations.size) keep("destinations", await db.select({ slug: destinations.slug }).from(destinations).where(and(inArray(destinations.slug, [...wanted.destinations]), eq(destinations.isPublished, true))));
  if (wanted.places.size) keep("places", await db.select({ slug: places.slug }).from(places).where(and(inArray(places.slug, [...wanted.places]), eq(places.isPublished, true))));
  return text.replace(CATALOGUE_LINK, (all, label: string, section: string, slug: string) => (known.has(`${group(section)}:${slug}`) ? all : label));
}

const LANG_NAME: Record<Locale, string> = { en: "English", uz: "Uzbek (Latin script, natural modern Uzbek)", ru: "Russian" };

/** Protected core rules. Owners can append tone/extra rules, but cannot remove these. */
export function systemPrompt(s: AiSettings, lang: Locale, page: string | null, mode: "chat" | "planner", trip: string | null = null): string {
  return [
    `You are "${s.assistantName}", the in-house travel consultant and AI travel guide of Gulistan Travel, a travel company in Uzbekistan. You help visitors discover Uzbekistan and Central Asia, choose tours, hotels, restaurants and transport from OUR catalogue, plan realistic itineraries, explain culture and etiquette, translate useful phrases, estimate budgets and send booking requests.`,
    `Reply in ${LANG_NAME[lang]}. Be warm, concise and practical (short paragraphs or bullet points, max ~180 words unless planning a trip). Do not use Markdown tables or headings.`,
    "CORE RULES (never break):",
    "1. For anything about our tours, prices, durations, routes, itineraries, departures or destinations, call the tools first and base the answer on their results. For practical travel questions (money, SIM cards, food, etiquette, seasons, packing, experiences, transfers, guides) call search_site_content and answer from those passages, linking the page. Prefer company data over general knowledge.",
    "1b. Where to stay or eat (hotels, guesthouses, restaurants, cafés, halal/vegetarian food): call search_places. Getting between cities or around a city (trains, flights, transfers, taxis, metro): call get_transport_options. 'What is near X': call find_nearby. Translating or 'how do I say': call get_phrases. Budgets: call calculate_trip_budget, passing chosen tours, hotels (with nights) and transport. Recommend 2–3 options with one line each on why they fit.",
    "2. Never invent tours, hotels, restaurants, availability, seats, timetables, prices or booking status. Prices from tools are INDICATIVE 'from' prices; say so. Train and flight times are TYPICAL, not live. Rooms, tables, seats and the final price are confirmed by our travel manager after the visitor sends a request. Clearly separate estimates from confirmed facts.",
    "3. Never claim a booking or reservation is confirmed. To help someone book, call prepare_booking_inquiry; this only prepares a draft that the visitor reviews and sends on the booking form. Ask for their confirmation of tour, date and number of travellers first if they are unclear.",
    "4. When you mention a tour, destination, hotel, restaurant or transport option, link it with its url from the tool results using Markdown [Title](url), keeping the url exactly as given (a relative path such as /uz/tours/slug, never with a domain added). Do not make up URLs. Useful pages: /LANG/trip-builder (trip constructor), /LANG/transport (flights & trains), /LANG/hotels, /LANG/restaurants, /LANG/navigator (travel map), /LANG/virtual-tours.".replaceAll("LANG", lang),
    "5. If information is missing, say so plainly and offer the contact page or a tailor-made request.",
    "6. Visa, border, health and safety rules change: give the general picture and tell the visitor to verify with official sources (e.g. the e-visa portal or their embassy). Do not state those as facts the company guarantees.",
    "7. Itineraries must be realistic: Tashkent–Samarkand ~2h10 by Afrosiyob train, Samarkand–Bukhara ~1h40 train, Bukhara–Khiva ~6–7h by road or overnight train, Tashkent–Fergana valley ~4–5h by road/train, Tashkent–Urgench (for Khiva) ~1h40 flight. Do not put more than one long transfer in a day.",
    "8. Never ask for or repeat passwords, card numbers or ID numbers. Do not ask for personal details in chat; the booking form collects them.",
    "9. Stay on travel topics related to Uzbekistan/Central Asia and Gulistan Travel. Politely decline unrelated tasks.",
    page ? `The visitor is currently on page: ${page}. Use it as context (e.g. 'this tour').` : "",
    trip
      ? `The visitor's current trip plan from the trip constructor (their own notes, not confirmed bookings): ${trip}. Use it as context. When they ask to change the plan, propose concrete changes by day (add, remove, move) using catalogue items from the tools; cards under your answer let them add items to the trip.`
      : "",
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
  cards: AiCard[];
  bookingDraft: ToolContext["bookingDraft"] | null;
  language: Locale;
  messageId: number | null;
}

const FALLBACK_TEXT: Record<Locale, string> = {
  en: "Our AI assistant is unavailable right now, so here are matching tours from our catalogue. You can also book directly or message our team.",
  uz: "AI yordamchi hozir ishlamayapti, shuning uchun katalogimizdan mos turlarni koʻrsatyapman. Toʻgʻridan-toʻgʻri bron soʻrovi yuborishingiz yoki jamoamizga yozishingiz mumkin.",
  ru: "ИИ-помощник сейчас недоступен, поэтому показываю подходящие туры из каталога. Вы также можете отправить заявку напрямую или написать нашей команде.",
};

/** Fallback openers when the question was about hotels, restaurants, transport or phrases. */
const FALLBACK_KIND_TEXT: Record<Exclude<FallbackKind, "tour">, Record<Locale, string>> = {
  hotel: {
    en: "Our AI assistant is unavailable right now, so here are hotels from our catalogue that may suit you. Send a request from any hotel page and our travel manager will confirm rooms and prices.",
    uz: "AI yordamchi hozir ishlamayapti, shuning uchun katalogimizdan mos mehmonxonalarni koʻrsatyapman. Istalgan mehmonxona sahifasidan soʻrov yuboring, menejerimiz xona va narxni tasdiqlaydi.",
    ru: "ИИ-помощник сейчас недоступен, поэтому показываю подходящие отели из каталога. Отправьте заявку со страницы отеля, и наш менеджер подтвердит номер и цену.",
  },
  restaurant: {
    en: "Our AI assistant is unavailable right now, so here are restaurants from our catalogue. You can request a table from any restaurant page.",
    uz: "AI yordamchi hozir ishlamayapti, shuning uchun katalogimizdan restoranlarni koʻrsatyapman. Istalgan restoran sahifasidan stol band qilish soʻrovini yuborishingiz mumkin.",
    ru: "ИИ-помощник сейчас недоступен, поэтому показываю рестораны из каталога. Забронировать стол можно со страницы ресторана.",
  },
  transport: {
    en: "Our AI assistant is unavailable right now, so here are transport options from our catalogue with typical times and indicative fares. Compare them on the flights & trains page.",
    uz: "AI yordamchi hozir ishlamayapti, shuning uchun katalogimizdagi transport variantlarini odatiy vaqt va taxminiy narxlar bilan koʻrsatyapman. Ularni aviareys va poyezdlar sahifasida solishtiring.",
    ru: "ИИ-помощник сейчас недоступен, поэтому показываю варианты транспорта из каталога с типичным временем и ориентировочными ценами. Сравните их на странице авиа и поездов.",
  },
  phrases: {
    en: "Our AI assistant is unavailable right now. Here are useful phrases from our phrasebook:",
    uz: "AI yordamchi hozir ishlamayapti. Soʻzlashgichimizdan foydali iboralar:",
    ru: "ИИ-помощник сейчас недоступен. Полезные фразы из нашего разговорника:",
  },
};

export async function runAgent(opts: {
  db: Db;
  conversationId: string;
  history: ChatTurn[];
  locale: Locale;
  page: string | null;
  mode: "chat" | "planner";
  settings: AiSettings;
  /** Compact summary of the visitor's trip constructor plan (no personal data). */
  trip?: string | null;
}): Promise<AgentReply> {
  const { db, conversationId, history, page, mode, settings: s } = opts;
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const language = detectLanguage(lastUser, opts.locale);
  const ctx: ToolContext = { db, locale: language, conversationId, sources: new Set(), cards: new Map() };
  const chain = s.enabled ? providerChain() : [];
  const started = Date.now();
  let lastError: string | null = null;

  for (const [index, adapter] of chain.entries()) {
    try {
      const request: RunInput = {
        system: systemPrompt(s, language, page, mode, opts.trip ?? null),
        history: history.slice(-12),
        tools: TOOL_SPECS,
        execute: (name, args) => executeTool(ctx, name, args),
        temperature: s.temperature,
        maxOutputTokens: mode === "planner" ? Math.max(s.maxOutputTokens, 2500) : s.maxOutputTokens,
        timeoutMs: mode === "planner" ? Math.max(s.timeoutMs, 45000) : s.timeoutMs,
        json: mode === "planner",
      };
      let res;
      try {
        res = await adapter.run(request);
      } catch (err) {
        // One quick retry on a temporary outage of the first provider before moving down the chain.
        if (index !== 0 || !(err instanceof ProviderError) || err.kind !== "unavailable") throw err;
        await new Promise((r) => setTimeout(r, 700));
        res = await adapter.run(request);
      }
      if (!res.text) throw new ProviderError(adapter.id, "bad_response", "empty answer");
      // Second line of defence: never let a reply claim a confirmed booking, guaranteed seats or ask for payment.
      if (mode === "chat") {
        res.text = await unlinkUnknownPages(db, relativizeSiteLinks(res.text));
        const safe = enforceSafeReply(res.text, language);
        if (safe.flagged.length) {
          res.text = safe.text;
          lastError = `guard:${safe.flagged.join(",")}`;
        }
        // The model writes the current Latin spelling; the site shows Uzbek in the new alphabet.
        if (language === "uz") res.text = uzText(res.text);
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
  const shown = (s: string) => (language === "uz" ? uzText(s) : s);
  const text =
    found.kind === "phrases"
      ? `${shown(FALLBACK_KIND_TEXT.phrases[language])}\n\n${phrasesAsText(lastUser, language)}`
      : shown(found.kind !== "tour" && found.count ? FALLBACK_KIND_TEXT[found.kind][language] : FALLBACK_TEXT[language]);
  const [msg] = await db
    .insert(aiMessages)
    .values({ conversationId, role: "assistant", content: text, sources: [...ctx.sources], latencyMs: Date.now() - started, status: chain.length ? "error" : "fallback", error: lastError ?? (chain.length ? null : "no_provider_configured") })
    .returning({ id: aiMessages.id });
  return { conversationId, text, status: "fallback", provider: null, cards: found.count ? [...ctx.cards.values()].slice(0, 4) : [], bookingDraft: null, language, messageId: msg?.id ?? null };
}
