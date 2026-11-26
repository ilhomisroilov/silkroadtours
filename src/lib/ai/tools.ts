import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { aiToolLogs, contentItems, destinations, faqItems, tourDepartures, tourDestinations, tourItineraryDays, tours } from "@/db/schema";
import { getContact, getRates } from "@/db/queries/settings";
import type { Locale, LocalizedText } from "@/db/types";
import { todayTashkent } from "@/db/batch";
import type { ToolSpec } from "./providers";

/**
 * Read-only knowledge tools the model may call. Every input is validated with zod; tools only run
 * fixed, parameterised queries against published content — never arbitrary SQL. The one "action"
 * tool (prepare_booking_inquiry) creates NOTHING: it returns a draft the visitor must confirm on the
 * real booking form, where the normal validation, rate limiting and anti-spam checks apply.
 */

const L = (t: LocalizedText | null | undefined, locale: Locale) => (t ? t[locale] || t.en || "" : "");
const norm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ'ʻʼ’`‘]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ");

/** Common transliterations so "Samarqand", "Самарканд" and "Samarkand" all match. */
const ALIASES: Record<string, string[]> = {
  samarkand: ["samarqand", "самарканд", "samarkand", "registan"],
  bukhara: ["buxoro", "бухара", "bukhara", "buhara"],
  khiva: ["xiva", "хива", "khiva", "itchan"],
  tashkent: ["toshkent", "ташкент", "tashkent"],
  shakhrisabz: ["shahrisabz", "шахрисабз", "shakhrisabz", "shahrisyabz"],
  "fergana-valley": ["fargona", "фергана", "fergana", "rishton", "margilan", "marg'ilon", "kokand", "qoqon"],
  zaamin: ["zomin", "заамин", "zaamin"],
  "chimgan-charvak": ["chimyon", "chimgan", "чимган", "charvak", "chorvoq", "чарвак"],
  "karakalpakstan-aral": ["qoraqalpogiston", "каракалпакстан", "aral", "orol", "арал", "moynaq", "muynak", "ayaz"],
};

function aliasHits(text: string): string[] {
  const n = norm(text);
  return Object.entries(ALIASES)
    .filter(([, names]) => names.some((a) => n.includes(norm(a))))
    .map(([slug]) => slug);
}

/** Splits a Markdown article into ~700-character passages on paragraph boundaries (for retrieval). */
function passages(md: string, max = 700): string[] {
  const paras = md.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > max) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out.map((x) => x.slice(0, 1200));
}

function textScore(hay: string, query: string): number {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 2);
  const h = norm(hay);
  return words.reduce((s, w) => s + (h.includes(w) ? 1 : 0), 0);
}

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "search_tours",
    description:
      "Search the company's PUBLISHED tours. Use for any question about tours, prices, durations or recommendations. Returns title, url, duration, indicative from-price in USD, destinations and category.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text: interests, places, style (any language)." },
        destination: { type: "string", description: "Destination slug or name, e.g. samarkand, bukhara, khiva." },
        maxDays: { type: "integer", description: "Maximum tour length in days." },
        maxPriceUsd: { type: "number", description: "Maximum indicative price per person in USD." },
        category: { type: "string", description: "cultural, adventure, nature, gastronomy, family, pilgrimage, city, etc." },
        audience: { type: "string", enum: ["inbound", "domestic"], description: "inbound = international visitors, domestic = residents of Uzbekistan." },
      },
    },
  },
  {
    name: "get_tour_details",
    description: "Full details of ONE published tour by slug: itinerary, included/excluded, accommodation, transport, upcoming departures with seats, price tiers.",
    parameters: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "search_destinations",
    description: "List destinations the company covers, optionally filtered by text or month (best time to visit).",
    parameters: { type: "object", properties: { query: { type: "string" }, month: { type: "integer", description: "1-12" } } },
  },
  {
    name: "get_destination_details",
    description: "Overview, attractions, best time and related tours for one destination by slug.",
    parameters: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "get_faq_answer",
    description: "Search the company's approved FAQ (visas, payments, booking policy, safety, transport, etc.).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_site_content",
    description:
      "Retrieve passages from the company's own published travel guides (visas, money, SIM cards, food, etiquette, seasons, packing), experiences (cooking classes, crafts, camel rides…) and services (transfers, guides, hotels). Use for practical travel questions and anything not answered by tours or FAQ. Answer only from the returned passages and link the url.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the visitor wants to know, in any language." },
        kind: { type: "string", enum: ["guide", "experience", "service"], description: "Optional: limit to one kind of content." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_contact_information",
    description: "Company contact channels (phone, email, Telegram, WhatsApp, office address) as configured by the company.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "calculate_trip_budget",
    description:
      "Estimate a per-person budget in USD for a trip, combining selected catalogue tours (indicative from-prices) with typical daily costs. Result is an ESTIMATE, never a confirmed price.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer" },
        style: { type: "string", enum: ["budget", "comfort", "premium"] },
        tourSlugs: { type: "array", items: { type: "string" } },
        travellers: { type: "integer" },
      },
      required: ["days"],
    },
  },
  {
    name: "prepare_booking_inquiry",
    description:
      "Prepare (NOT submit) a booking request for a tour. Returns a draft and a link to the booking form. The visitor must review and submit it themselves. Never say a booking is confirmed.",
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string" },
        preferredDate: { type: "string", description: "YYYY-MM-DD if known" },
        adults: { type: "integer" },
        children: { type: "integer" },
      },
      required: ["slug"],
    },
  },
];

const schemas = {
  search_tours: z.object({
    query: z.string().max(300).optional(),
    destination: z.string().max(60).optional(),
    maxDays: z.coerce.number().int().min(1).max(60).optional(),
    maxPriceUsd: z.coerce.number().min(0).max(100000).optional(),
    category: z.string().max(40).optional(),
    audience: z.enum(["inbound", "domestic"]).optional(),
  }),
  get_tour_details: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }),
  search_destinations: z.object({ query: z.string().max(200).optional(), month: z.coerce.number().int().min(1).max(12).optional() }),
  get_destination_details: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }),
  get_faq_answer: z.object({ query: z.string().min(1).max(300) }),
  get_contact_information: z.object({}).passthrough(),
  search_site_content: z.object({ query: z.string().min(1).max(300), kind: z.enum(["guide", "experience", "service"]).optional() }),
  calculate_trip_budget: z.object({
    days: z.coerce.number().int().min(1).max(30),
    style: z.enum(["budget", "comfort", "premium"]).default("comfort"),
    tourSlugs: z.array(z.string().regex(/^[a-z0-9-]{1,120}$/)).max(6).default([]),
    travellers: z.coerce.number().int().min(1).max(30).default(1),
  }),
  prepare_booking_inquiry: z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    adults: z.coerce.number().int().min(1).max(30).default(2),
    children: z.coerce.number().int().min(0).max(20).default(0),
  }),
} as const;

export type ToolName = keyof typeof schemas;

/** Typical per-person daily costs in USD, used only for labelled estimates (hotel twin share, meals, local transport, entries). */
export const DAILY_COST_USD = { budget: 55, comfort: 95, premium: 190 } as const;

export interface ToolContext {
  db: Db;
  locale: Locale;
  conversationId: string | null;
  /** Collected for the UI: tours/destinations referenced, and a booking draft if prepared. */
  sources: Set<string>;
  cards: Map<string, { kind: "tour" | "destination"; slug: string; title: string; url: string; image: string; meta: string }>;
  bookingDraft?: { slug: string; title: string; url: string; adults: number; children: number; preferredDate?: string };
}

async function usdFrom(db: Db) {
  const rates = await getRates(db);
  return (minor: number, currency: "USD" | "UZS" | "EUR") => {
    const major = currency === "UZS" ? minor : minor / 100;
    return Math.round(major / (rates.rates[currency] || 1));
  };
}

async function publishedTours(db: Db) {
  return db
    .select({
      id: tours.id,
      slug: tours.slug,
      audience: tours.audience,
      category: tours.category,
      title: tours.title,
      summary: tours.summary,
      durationDays: tours.durationDays,
      baseCurrency: tours.baseCurrency,
      fromPriceMinor: tours.fromPriceMinor,
      heroImage: tours.heroImage,
      primaryDestinationId: tours.primaryDestinationId,
      seasonMonths: tours.seasonMonths,
      ratingAvg: tours.ratingAvg,
      ratingCount: tours.ratingCount,
      minGroup: tours.minGroup,
    })
    .from(tours)
    .where(eq(tours.isPublished, true));
}

export async function executeTool(ctx: ToolContext, name: string, rawArgs: Record<string, unknown>): Promise<unknown> {
  const schema = schemas[name as ToolName];
  if (!schema) return { error: "unknown_tool" };
  const parsed = schema.safeParse(rawArgs ?? {});
  let result: unknown;
  let count: number | null = null;
  if (!parsed.success) {
    result = { error: "invalid_arguments", issues: parsed.error.issues.map((i) => i.message).slice(0, 3) };
  } else {
    try {
      result = await run(ctx, name as ToolName, parsed.data as never);
      const r = result as { tours?: unknown[]; destinations?: unknown[]; items?: unknown[] };
      count = r.tours?.length ?? r.destinations?.length ?? r.items?.length ?? null;
    } catch (err) {
      console.error("[ai tool]", name, err);
      result = { error: "tool_failed" };
    }
  }
  try {
    await ctx.db.insert(aiToolLogs).values({
      conversationId: ctx.conversationId,
      tool: name,
      input: JSON.stringify(rawArgs ?? {}).slice(0, 2000),
      ok: !(result as { error?: string })?.error,
      resultCount: count,
    });
  } catch {
    /* logging must never break the answer */
  }
  return result;
}

async function run(ctx: ToolContext, name: ToolName, args: never): Promise<unknown> {
  const { db, locale } = ctx;
  const toUsd = await usdFrom(db);
  const tourUrl = (slug: string) => `/${locale}/tours/${slug}`;
  const destUrl = (slug: string) => `/${locale}/destinations/${slug}`;

  switch (name) {
    case "search_tours": {
      const a = args as z.infer<typeof schemas.search_tours>;
      const [all, dests, links] = await Promise.all([
        publishedTours(db),
        db.select({ id: destinations.id, slug: destinations.slug, name: destinations.name }).from(destinations),
        db.select().from(tourDestinations),
      ]);
      const destById = new Map(dests.map((d) => [d.id, d]));
      const wanted = new Set([...(a.destination ? aliasHits(a.destination).concat(a.destination.toLowerCase()) : []), ...(a.query ? aliasHits(a.query) : [])]);
      const scored = all
        .map((t) => {
          const dIds = new Set([t.primaryDestinationId, ...links.filter((l) => l.tourId === t.id).map((l) => l.destinationId)]);
          const dSlugs = [...dIds].map((id) => destById.get(id)?.slug).filter(Boolean) as string[];
          const priceUsd = toUsd(t.fromPriceMinor, t.baseCurrency);
          let score = 0;
          if (wanted.size) score += dSlugs.some((s) => wanted.has(s)) ? 5 : -3;
          if (a.query) score += textScore(`${Object.values(t.title).join(" ")} ${Object.values(t.summary).join(" ")} ${t.category}`, a.query);
          if (a.category && t.category === a.category) score += 2;
          return { t, dSlugs, priceUsd, score };
        })
        .filter(({ t, priceUsd }) => (!a.maxDays || t.durationDays <= a.maxDays) && (!a.maxPriceUsd || priceUsd <= a.maxPriceUsd) && (!a.audience || t.audience === a.audience) && (!a.category || t.category === a.category || !!a.query))
        .sort((x, y) => y.score - x.score || x.priceUsd - y.priceUsd)
        .slice(0, 6);
      const out = scored.map(({ t, dSlugs, priceUsd }) => {
        const title = L(t.title, locale);
        ctx.sources.add(`tour:${t.slug}`);
        ctx.cards.set(`tour:${t.slug}`, { kind: "tour", slug: t.slug, title, url: tourUrl(t.slug), image: t.heroImage, meta: `${t.durationDays}d · from $${priceUsd}` });
        return {
          slug: t.slug,
          title,
          url: tourUrl(t.slug),
          summary: L(t.summary, locale).slice(0, 220),
          days: t.durationDays,
          category: t.category,
          audience: t.audience,
          destinations: dSlugs,
          indicativeFromPriceUsdPerPerson: priceUsd,
          rating: t.ratingCount ? `${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : "no reviews yet",
        };
      });
      return { tours: out, note: out.length ? "Prices are indicative 'from' prices; the company confirms the final price in writing." : "No published tour matches. Suggest a tailor-made request or contacting the company." };
    }
    case "get_tour_details": {
      const { slug } = args as z.infer<typeof schemas.get_tour_details>;
      const [t] = await db.select().from(tours).where(and(eq(tours.slug, slug), eq(tours.isPublished, true))).limit(1);
      if (!t) return { error: "tour_not_found_or_unpublished" };
      const [days, deps] = await Promise.all([
        db.select().from(tourItineraryDays).where(eq(tourItineraryDays.tourId, t.id)).orderBy(asc(tourItineraryDays.dayNumber)),
        db
          .select()
          .from(tourDepartures)
          .where(and(eq(tourDepartures.tourId, t.id), gte(tourDepartures.startDate, todayTashkent())))
          .orderBy(asc(tourDepartures.startDate))
          .limit(6),
      ]);
      const title = L(t.title, locale);
      ctx.sources.add(`tour:${t.slug}`);
      ctx.cards.set(`tour:${t.slug}`, { kind: "tour", slug: t.slug, title, url: tourUrl(t.slug), image: t.heroImage, meta: `${t.durationDays}d · from $${toUsd(t.fromPriceMinor, t.baseCurrency)}` });
      return {
        slug: t.slug,
        title,
        url: tourUrl(t.slug),
        description: L(t.description, locale).slice(0, 1500),
        days: t.durationDays,
        nights: t.durationNights,
        difficulty: t.difficulty,
        group: `${t.minGroup}-${t.maxGroup}`,
        indicativeFromPriceUsdPerPerson: toUsd(t.fromPriceMinor, t.baseCurrency),
        childPricePercent: t.childPricePercent,
        guideLanguages: t.guideLanguages,
        seasonMonths: t.seasonMonths,
        included: t.included.map((x) => L(x, locale)),
        excluded: t.excluded.map((x) => L(x, locale)),
        accommodation: t.accommodation.map((x) => `${x.type}: ${L(x.name, locale)} (${x.nights} nights)`),
        transport: t.transport.map((x) => `${x.mode}: ${L(x.description, locale)}`),
        itinerary: days.map((d) => ({ day: d.dayNumber, title: L(d.title, locale), description: L(d.description, locale).slice(0, 400) })),
        upcomingDepartures: deps
          .filter((d) => d.status === "open" || d.status === "guaranteed")
          .map((d) => ({ start: d.startDate, end: d.endDate, seatsLeft: Math.max(0, d.seatsTotal - d.seatsBooked), status: d.status })),
        privateTourAvailable: true,
        note: "Seats and prices come from the booking system and must be re-confirmed by the company before payment.",
      };
    }
    case "search_destinations": {
      const a = args as z.infer<typeof schemas.search_destinations>;
      const rows = await db.select().from(destinations).where(eq(destinations.isPublished, true)).orderBy(asc(destinations.sortOrder));
      const hits = a.query ? new Set(aliasHits(a.query)) : null;
      const out = rows
        .filter((d) => (!a.month || d.bestMonths.includes(a.month)) && (!hits || hits.size === 0 || hits.has(d.slug) || textScore(Object.values(d.name).join(" ") + Object.values(d.tagline).join(" "), a.query!) > 0))
        .map((d) => {
          ctx.sources.add(`destination:${d.slug}`);
          ctx.cards.set(`destination:${d.slug}`, { kind: "destination", slug: d.slug, title: L(d.name, locale), url: destUrl(d.slug), image: d.heroImage, meta: L(d.tagline, locale).slice(0, 60) });
          return { slug: d.slug, name: L(d.name, locale), tagline: L(d.tagline, locale), bestTime: L(d.bestTime, locale), bestMonths: d.bestMonths, url: destUrl(d.slug) };
        });
      return { destinations: out };
    }
    case "get_destination_details": {
      const { slug } = args as z.infer<typeof schemas.get_destination_details>;
      const [d] = await db.select().from(destinations).where(and(eq(destinations.slug, slug), eq(destinations.isPublished, true))).limit(1);
      if (!d) return { error: "destination_not_found" };
      const tourIds = (await db.select().from(tourDestinations).where(eq(tourDestinations.destinationId, d.id))).map((r) => r.tourId);
      const related = (await publishedTours(db)).filter((t) => t.primaryDestinationId === d.id || tourIds.includes(t.id));
      ctx.sources.add(`destination:${d.slug}`);
      ctx.cards.set(`destination:${d.slug}`, { kind: "destination", slug: d.slug, title: L(d.name, locale), url: destUrl(d.slug), image: d.heroImage, meta: L(d.tagline, locale).slice(0, 60) });
      return {
        slug: d.slug,
        name: L(d.name, locale),
        url: destUrl(d.slug),
        overview: L(d.overview, locale).slice(0, 1500),
        bestTime: L(d.bestTime, locale),
        attractions: d.attractions.map((x) => ({ name: L(x.name, locale), description: L(x.description, locale).slice(0, 240) })),
        tours: related.map((t) => ({ slug: t.slug, title: L(t.title, locale), days: t.durationDays, indicativeFromPriceUsd: toUsd(t.fromPriceMinor, t.baseCurrency), url: tourUrl(t.slug) })),
      };
    }
    case "get_faq_answer": {
      const { query } = args as z.infer<typeof schemas.get_faq_answer>;
      const rows = await db.select().from(faqItems).where(eq(faqItems.isPublished, true));
      const items = rows
        .map((f) => ({ f, s: textScore(`${Object.values(f.question).join(" ")} ${Object.values(f.answer).join(" ")} ${f.category}`, query) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map(({ f }) => {
          ctx.sources.add(`faq:${f.id}`);
          return { category: f.category, question: L(f.question, locale), answer: L(f.answer, locale) };
        });
      return { items, note: items.length ? "Company-approved answers." : "No approved FAQ entry. For visas and border rules, tell the visitor to verify on official sources." };
    }
    case "search_site_content": {
      const a = args as z.infer<typeof schemas.search_site_content>;
      const conds = [eq(contentItems.isPublished, true)];
      if (a.kind) conds.push(eq(contentItems.kind, a.kind));
      const rows = await db.select().from(contentItems).where(and(...conds));
      const pathFor = { guide: "travel-guide", experience: "experiences", service: "services" } as const;
      const hits = rows
        .flatMap((c) => passages(L(c.body, locale) || c.body.en).map((text, i) => ({ c, text, i, s: textScore(`${L(c.title, locale)} ${c.title.en} ${c.category ?? ""} ${text}`, a.query) + (i === 0 ? textScore(L(c.excerpt, locale), a.query) * 0.5 : 0) })))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s);
      const seen = new Map<number, number>();
      const items = [];
      for (const h of hits) {
        const n = seen.get(h.c.id) ?? 0;
        if (n >= 2) continue;
        seen.set(h.c.id, n + 1);
        ctx.sources.add(`${h.c.kind}:${h.c.slug}`);
        items.push({ kind: h.c.kind, title: L(h.c.title, locale), url: `/${locale}/${pathFor[h.c.kind]}/${h.c.slug}`, passage: h.text });
        if (items.length >= 4) break;
      }
      return { items, note: items.length ? "Passages from the company's own published pages." : "Nothing relevant on the site. Say so and offer the contact page or the custom tour builder." };
    }
    case "get_contact_information": {
      const c = await getContact(db);
      return {
        agencyName: c.agencyName,
        phone: c.phone || null,
        email: c.email || null,
        whatsapp: c.whatsapp || null,
        telegram: c.telegram || null,
        contactPage: `/${locale}/contact`,
        note: "Only share channels that are not null.",
      };
    }
    case "calculate_trip_budget": {
      const a = args as z.infer<typeof schemas.calculate_trip_budget>;
      const rows = a.tourSlugs.length ? (await publishedTours(db)).filter((t) => a.tourSlugs.includes(t.slug)) : [];
      const tourCost = rows.reduce((s, t) => s + toUsd(t.fromPriceMinor, t.baseCurrency), 0);
      const tourDays = rows.reduce((s, t) => s + t.durationDays, 0);
      const freeDays = Math.max(0, a.days - tourDays);
      const daily = DAILY_COST_USD[a.style];
      const low = Math.round(tourCost + freeDays * daily * 0.85);
      const high = Math.round(tourCost + freeDays * daily * 1.15 + 25);
      return {
        currency: "USD",
        perPersonEstimate: { low, high },
        groupEstimate: { low: low * a.travellers, high: high * a.travellers },
        breakdown: { tours: rows.map((t) => ({ slug: t.slug, indicativeFromUsd: toUsd(t.fromPriceMinor, t.baseCurrency), days: t.durationDays })), independentDays: freeDays, typicalDailyCostUsd: daily },
        excludes: "International flights, visas, insurance, tips.",
        label: "ESTIMATE — not a confirmed price",
      };
    }
    case "prepare_booking_inquiry": {
      const a = args as z.infer<typeof schemas.prepare_booking_inquiry>;
      const [t] = await db.select({ slug: tours.slug, title: tours.title }).from(tours).where(and(eq(tours.slug, a.slug), eq(tours.isPublished, true))).limit(1);
      if (!t) return { error: "tour_not_found_or_unpublished" };
      const qs = new URLSearchParams({ adults: String(a.adults), children: String(a.children), ...(a.preferredDate ? { date: a.preferredDate } : {}), utm_source: "ai_assistant" });
      const url = `/${locale}/book/${t.slug}?${qs}`;
      ctx.bookingDraft = { slug: t.slug, title: L(t.title, locale), url, adults: a.adults, children: a.children, preferredDate: a.preferredDate };
      return { status: "draft_only_not_submitted", reviewAndSubmitUrl: url, message: "Tell the visitor a confirmation card is shown; they must review and send the request. It is not a confirmed booking." };
    }
  }
}

/** Used by the non-AI fallback: plain catalogue search for a question. */
export async function fallbackSearch(ctx: ToolContext, question: string) {
  return (await executeTool(ctx, "search_tours", { query: question })) as { tours: { title: string; url: string; days: number; indicativeFromPriceUsdPerPerson: number }[] };
}

