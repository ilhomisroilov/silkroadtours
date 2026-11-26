import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { aiToolLogs, contentItems, destinations, faqItems, tourDepartures, tourDestinations, tourItineraryDays, tours } from "@/db/schema";
import { getContact, getRates } from "@/db/queries/settings";
import { distanceKm, listAttractions, listPlaces, type Place } from "@/db/queries/places";
import type { HotelDetails, Locale, LocalizedText, RestaurantDetails, TransportDetails } from "@/db/types";
import { guessPhraseTopic, PHRASEBOOK, PHRASE_TOPICS, type PhraseTopic } from "./phrasebook";
import { todayTashkent } from "@/db/batch";
import type { ToolSpec } from "./providers";
import { uzText } from "@/lib/uz-alphabet";

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
    .replace(/ş/g, "sh")
    .replace(/ç/g, "ch")
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
  nukus: ["nukus", "нукус", "savitsky", "savitskiy"],
  termez: ["termiz", "термез", "termez", "surxondaryo", "surkhandarya"],
  kokand: ["kokand", "qoqon", "коканд"],
  margilan: ["margilan", "margilon", "маргилан"],
  aydarkul: ["aydarkul", "aydarko'l", "aydarkol", "айдаркуль", "yurt camp"],
  nuratau: ["nuratau", "nurota", "нуратау", "нурата"],
  boysun: ["boysun", "baysun", "байсун"],
  sarmishsay: ["sarmishsay", "sarmish", "сармишсай"],
  dubai: ["dubai", "dubay", "дубай"],
  istanbul: ["istanbul", "стамбул"],
};

/** Every card the assistant can show under an answer; `trip` lets the page offer "Add to trip". */
export type AiCardKind = "tour" | "destination" | "hotel" | "restaurant" | "transport" | "attraction";
export interface AiCard {
  kind: AiCardKind;
  slug: string;
  title: string;
  url: string;
  image: string;
  meta: string;
  trip?: { id: string; kind: string; title: string; refSlug?: string; destinationSlug?: string; priceUsd?: number; priceUnit?: "night" | "person" | "trip" | "meal" | "group"; lat?: number; lng?: number; image?: string; meta?: string };
}

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
        hotels: {
          type: "array",
          description: "Hotels from search_places with the number of nights in each.",
          items: { type: "object", properties: { slug: { type: "string" }, nights: { type: "integer" } }, required: ["slug", "nights"] },
        },
        transportSlugs: { type: "array", items: { type: "string" }, description: "Transport option slugs from get_transport_options (fare per person)." },
      },
      required: ["days"],
    },
  },
  {
    name: "search_places",
    description:
      "Search our catalogue of partner HOTELS, RESTAURANTS and TRANSPORT options (published only). Use for where to stay, where to eat, food spots, dietary needs (halal, vegetarian, vegan), and transport options in a city. Returns name, url, area, indicative from-price in USD and key details (stars, amenities, room types; cuisine, dietary, hours, sample menu; mode, route, duration, classes).",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["hotel", "restaurant", "transport"] },
        destination: { type: "string", description: "Destination slug or city name, e.g. samarkand, bukhara, tashkent." },
        query: { type: "string", description: "Free text: style, area, cuisine, amenity (any language)." },
        maxPriceUsd: { type: "number", description: "Max indicative price: per night (hotel), per dish (restaurant) or per person (transport)." },
        dietary: { type: "string", description: "e.g. vegetarian, vegan, halal" },
      },
      required: ["kind"],
    },
  },
  {
    name: "get_transport_options",
    description:
      "Ways to travel between two cities (high-speed and regular trains, domestic flights, shared taxis, private transfers, buses) with typical duration, typical schedule and indicative fares per person. Also local transport inside a city when from and to are the same city.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "City name or destination slug" },
        to: { type: "string", description: "City name or destination slug" },
        mode: { type: "string", enum: ["train", "flight", "bus", "shared_taxi", "taxi", "transfer", "metro", "car"] },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "find_nearby",
    description:
      "Find attractions, restaurants and hotels near a landmark or in a destination, sorted by distance (km, with walking time when close). Use for 'what is near X', 'what can I see around my hotel', 'restaurants near Registan'.",
    parameters: {
      type: "object",
      properties: {
        near: { type: "string", description: "Landmark, hotel or restaurant name, e.g. Registan, Lyabi-Hauz, Chorsu bazaar." },
        destination: { type: "string", description: "Destination slug or city name." },
        kinds: { type: "array", items: { type: "string", enum: ["attraction", "restaurant", "hotel"] } },
      },
    },
  },
  {
    name: "get_phrases",
    description:
      "Useful Uzbek (Latin script) and Russian phrases with English meaning and pronunciation, from our checked phrasebook. Topics: greetings, courtesy, food, directions, shopping, numbers, transport, hotel, emergency. Use for any translation or 'how do I say' question.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", enum: [...PHRASE_TOPICS] },
        query: { type: "string", description: "What the visitor wants to say, if no topic fits." },
      },
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
    hotels: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/), nights: z.coerce.number().int().min(1).max(30) })).max(8).default([]),
    transportSlugs: z.array(z.string().regex(/^[a-z0-9-]{1,120}$/)).max(8).default([]),
  }),
  search_places: z.object({
    kind: z.enum(["hotel", "restaurant", "transport"]).default("hotel"),
    destination: z.string().max(60).optional(),
    query: z.string().max(300).optional(),
    maxPriceUsd: z.coerce.number().min(0).max(100000).optional(),
    dietary: z.string().max(40).optional(),
  }),
  get_transport_options: z.object({
    from: z.string().min(1).max(60),
    to: z.string().min(1).max(60),
    mode: z.enum(["train", "flight", "bus", "shared_taxi", "taxi", "transfer", "metro", "car"]).optional(),
  }),
  find_nearby: z.object({
    near: z.string().max(120).optional(),
    destination: z.string().max(60).optional(),
    kinds: z.array(z.enum(["attraction", "restaurant", "hotel"])).max(3).optional(),
  }),
  get_phrases: z.object({ topic: z.enum(PHRASE_TOPICS).optional(), query: z.string().max(200).optional() }),
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
/** The same without the hotel: meals, local transport and entry tickets, for nights covered by a chosen hotel. */
export const DAILY_EXTRAS_USD = { budget: 28, comfort: 48, premium: 95 } as const;

export interface ToolContext {
  db: Db;
  locale: Locale;
  conversationId: string | null;
  /** Collected for the UI: tours/destinations referenced, and a booking draft if prepared. */
  sources: Set<string>;
  cards: Map<string, AiCard>;
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

// ── Places (hotels, restaurants, transport) and nearby search ─────────────────────────────

const PLACE_PATH = { hotel: "hotels", restaurant: "restaurants" } as const;
const DIET_ALIASES: Record<string, string[]> = {
  vegetarian: ["vegetar", "вегетар", "goshtsiz", "без мяса"],
  vegan: ["vegan", "веган"],
  halal: ["halal", "halol", "халял", "халал"],
  "gluten-free": ["gluten", "глютен", "kleykovina"],
};

function cityMatch(text: string, wanted: string): boolean {
  const have = new Set(aliasHits(text));
  if (aliasHits(wanted).some((x) => have.has(x))) return true;
  const w = norm(wanted).trim();
  return w.length > 2 && norm(text).includes(w);
}

function destinationSlugs(text: string): Set<string> {
  return new Set([...aliasHits(text), norm(text).trim().split(/\s+/).join("-")]);
}

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`);

function fromPrice(locale: Locale, usd: number | null | undefined): string {
  if (usd == null) return "";
  return locale === "uz" ? `$${usd} dan` : locale === "ru" ? `от $${usd}` : `from $${usd}`;
}

function placeUrl(p: Place, locale: Locale): string {
  if (p.kind === "transport") {
    const d = p.details as TransportDetails;
    return `/${locale}/transport?${new URLSearchParams({ from: d.from, to: d.to })}`;
  }
  return `/${locale}/${PLACE_PATH[p.kind]}/${p.slug}`;
}

function placeHay(p: Place): string {
  const d = p.details as Partial<HotelDetails & RestaurantDetails & TransportDetails>;
  return [
    ...Object.values(p.name),
    ...Object.values(p.summary),
    p.slug,
    p.tags.join(" "),
    d.area ? Object.values(d.area).join(" ") : "",
    (d.cuisine ?? []).join(" "),
    (d.amenities ?? []).join(" "),
    (d.dietary ?? []).join(" "),
    d.from ?? "",
    d.to ?? "",
    d.mode ?? "",
  ].join(" ");
}

/** Facts the model may quote; every price is an indicative "from" price. */
function placeFacts(p: Place, locale: Locale) {
  const base = { slug: p.slug, name: L(p.name, locale), url: placeUrl(p, locale), destination: p.destinationSlug, summary: L(p.summary, locale).slice(0, 220) };
  if (p.kind === "hotel") {
    const h = p.details as HotelDetails;
    return {
      ...base,
      area: L(h.area, locale),
      stars: h.stars ?? null,
      amenities: h.amenities.slice(0, 8),
      roomTypes: h.roomTypes.map((r) => ({ name: L(r.name, locale), sleeps: r.sleeps, indicativeFromUsdPerNight: r.priceFromUsd })),
      indicativeFromUsdPerNight: p.priceFromUsd,
      checkIn: h.checkIn ?? null,
      checkOut: h.checkOut ?? null,
    };
  }
  if (p.kind === "restaurant") {
    const r = p.details as RestaurantDetails;
    return {
      ...base,
      area: L(r.area, locale),
      cuisine: r.cuisine,
      dietary: r.dietary,
      typicalHours: L(r.hours, locale),
      priceLevel: p.priceLevel ? "$".repeat(p.priceLevel) : null,
      sampleMenu: r.menu.slice(0, 5).map((m) => ({ dish: L(m.name, locale), indicativeUsd: m.priceUsd })),
    };
  }
  const t = p.details as TransportDetails;
  return {
    ...base,
    mode: t.mode,
    from: t.from,
    to: t.to,
    typicalDuration: hm(t.durationMin),
    operator: t.operator ?? null,
    typicalSchedule: L(t.scheduleNote, locale),
    classes: (t.classes ?? []).map((c) => ({ name: L(c.name, locale), indicativeFromUsdPerPerson: c.priceFromUsd })),
    indicativeFromUsdPerPerson: p.priceFromUsd,
  };
}

function addPlaceCard(ctx: ToolContext, p: Place): void {
  const { locale } = ctx;
  const title = L(p.name, locale);
  let meta = "";
  let unit: "night" | "meal" | "person" = "person";
  let tripKind = "transport";
  if (p.kind === "hotel") {
    const h = p.details as HotelDetails;
    meta = [h.stars ? "★".repeat(h.stars) : "", L(h.area, locale), fromPrice(locale, p.priceFromUsd)].filter(Boolean).join(" · ");
    unit = "night";
    tripKind = "hotel";
  } else if (p.kind === "restaurant") {
    const r = p.details as RestaurantDetails;
    meta = [r.cuisine.slice(0, 2).join(", "), L(r.area, locale), p.priceLevel ? "$".repeat(p.priceLevel) : ""].filter(Boolean).join(" · ");
    unit = "meal";
    tripKind = "restaurant";
  } else {
    const t = p.details as TransportDetails;
    meta = [`${t.from} → ${t.to}`, hm(t.durationMin), fromPrice(locale, p.priceFromUsd)].filter(Boolean).join(" · ");
    tripKind = t.mode === "train" ? "train" : t.mode === "flight" ? "flight" : t.mode === "transfer" || t.mode === "taxi" || t.mode === "car" ? "transfer" : "transport";
  }
  const key = `${p.kind}:${p.slug}`;
  ctx.sources.add(key);
  ctx.cards.set(key, {
    kind: p.kind,
    slug: p.slug,
    title,
    url: placeUrl(p, locale),
    image: p.image ?? "",
    meta,
    trip: {
      id: key,
      kind: tripKind,
      title,
      refSlug: p.slug,
      destinationSlug: p.destinationSlug ?? undefined,
      priceUsd: p.priceFromUsd ?? undefined,
      priceUnit: unit,
      lat: p.lat ?? undefined,
      lng: p.lng ?? undefined,
      image: p.image ?? undefined,
      meta,
    },
  });
}

function dietKey(text: string): string {
  const n = norm(text);
  for (const [key, words] of Object.entries(DIET_ALIASES)) if (n.includes(key) || words.some((w) => n.includes(norm(w)))) return key;
  return n.trim();
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
      const extras = DAILY_EXTRAS_USD[a.style];
      const placeRows = a.hotels.length || a.transportSlugs.length ? await listPlaces(db, { kinds: ["hotel", "transport"] }) : [];
      const rooms = Math.ceil(a.travellers / 2);
      const hotelLines = a.hotels.flatMap((h) => {
        const p = placeRows.find((x) => x.kind === "hotel" && x.slug === h.slug);
        return p && p.priceFromUsd != null ? [{ slug: p.slug, name: L(p.name, locale), nights: h.nights, rooms, indicativeFromUsdPerNight: p.priceFromUsd, groupUsd: p.priceFromUsd * h.nights * rooms }] : [];
      });
      const transportLines = a.transportSlugs.flatMap((slug) => {
        const p = placeRows.find((x) => x.kind === "transport" && x.slug === slug);
        return p && p.priceFromUsd != null ? [{ slug: p.slug, name: L(p.name, locale), indicativeFromUsdPerPerson: p.priceFromUsd }] : [];
      });
      const hotelPerPerson = hotelLines.reduce((s, h) => s + h.groupUsd, 0) / a.travellers;
      const transportPerPerson = transportLines.reduce((s, t) => s + t.indicativeFromUsdPerPerson, 0);
      const hotelDays = Math.min(freeDays, hotelLines.reduce((s, h) => s + h.nights, 0));
      const fullDays = freeDays - hotelDays;
      const fixed = tourCost + hotelPerPerson + transportPerPerson;
      const low = Math.round(fixed + (hotelDays * extras + fullDays * daily) * 0.85);
      const high = Math.round(fixed + (hotelDays * extras + fullDays * daily) * 1.15 + 25);
      return {
        currency: "USD",
        perPersonEstimate: { low, high },
        groupEstimate: { low: low * a.travellers, high: high * a.travellers },
        breakdown: {
          tours: rows.map((t) => ({ slug: t.slug, indicativeFromUsd: toUsd(t.fromPriceMinor, t.baseCurrency), days: t.durationDays })),
          hotels: hotelLines,
          transport: transportLines,
          independentDays: freeDays,
          typicalDailyCostUsd: daily,
          typicalDailyExtrasWithChosenHotelUsd: extras,
        },
        excludes: "International flights, visas, insurance, tips.",
        label: "ESTIMATE — not a confirmed price",
      };
    }
    case "search_places": {
      const a = args as z.infer<typeof schemas.search_places>;
      const all = await listPlaces(db, { kind: a.kind });
      const wanted = a.destination ? destinationSlugs(a.destination) : null;
      const inDest = wanted ? all.filter((p) => !!p.destinationSlug && wanted.has(p.destinationSlug)) : all;
      const diet = a.dietary ? dietKey(a.dietary) : null;
      const scored = inDest
        .filter((p) => a.maxPriceUsd == null || p.priceFromUsd == null || p.priceFromUsd <= a.maxPriceUsd)
        .filter((p) => !diet || norm(placeHay(p)).includes(diet) || p.tags.includes(diet))
        .map((p) => ({ p, s: a.query ? textScore(placeHay(p), a.query) : 0 }))
        .sort((x, y) => y.s - x.s || x.p.sortOrder - y.p.sortOrder)
        .slice(0, 6);
      scored.forEach(({ p }) => addPlaceCard(ctx, p));
      const coverage = [...new Set(all.map((p) => p.destinationSlug).filter(Boolean))];
      return {
        items: scored.map(({ p }) => placeFacts(p, locale)),
        listUrl: a.kind === "transport" ? `/${locale}/transport` : `/${locale}/${PLACE_PATH[a.kind]}${wanted && inDest[0]?.destinationSlug ? `?destination=${inDest[0].destinationSlug}` : ""}`,
        note: scored.length
          ? "Places from our partner catalogue. Prices are indicative 'from' prices; rooms, tables, seats and final prices are confirmed by our travel manager when the visitor sends a request."
          : `Nothing matches in our catalogue${wanted ? " for this destination" : ""}. Our catalogue covers: ${coverage.join(", ")}. Offer the closest alternative or a tailor-made request.`,
      };
    }
    case "get_transport_options": {
      const a = args as z.infer<typeof schemas.get_transport_options>;
      const rows = (await listPlaces(db, { kind: "transport" })).map((p) => ({ p, d: p.details as TransportDetails })).filter(({ d }) => !a.mode || d.mode === a.mode);
      const forward = rows.filter(({ d }) => cityMatch(d.from, a.from) && cityMatch(d.to, a.to));
      const reverse = rows.filter(({ d }) => !forward.some((f) => f.d === d) && cityMatch(d.from, a.to) && cityMatch(d.to, a.from));
      const list = [...forward.map((x) => ({ ...x, reverse: false })), ...reverse.map((x) => ({ ...x, reverse: true }))].sort((x, y) => x.d.durationMin - y.d.durationMin).slice(0, 6);
      list.forEach(({ p }) => addPlaceCard(ctx, p));
      const searchUrl = `/${locale}/transport?${new URLSearchParams({ from: a.from, to: a.to })}`;
      return {
        options: list.map(({ p, reverse: r }) => ({ ...placeFacts(p, locale), ...(r ? { direction: "listed in the opposite direction; the return trip has similar times and fares" } : {}) })),
        searchUrl,
        note: list.length
          ? "Typical durations and schedules with indicative fares per person. Exact departure times, seats and final fares are confirmed by our travel manager; the visitor can compare options and send a request on the transport page (searchUrl)."
          : "No option for this pair in our catalogue. Give general guidance from rule 7 and suggest a private transfer request or the transport page.",
      };
    }
    case "find_nearby": {
      const a = args as z.infer<typeof schemas.find_nearby>;
      const kinds = new Set(a.kinds?.length ? a.kinds : ["attraction", "restaurant", "hotel"]);
      const [attractions, places, dests] = await Promise.all([
        listAttractions(db),
        listPlaces(db, { kinds: ["hotel", "restaurant"] }),
        db.select({ slug: destinations.slug, name: destinations.name, lat: destinations.lat, lng: destinations.lng }).from(destinations).where(eq(destinations.isPublished, true)),
      ]);
      type Pt = { kind: "attraction" | "hotel" | "restaurant"; key: string; hay: string; name: string; lat: number; lng: number; destinationSlug: string | null; url: string; image: string; about: string; place?: Place };
      const points: Pt[] = [
        ...attractions.map((x) => ({
          kind: "attraction" as const,
          key: `attraction:${x.id}`,
          hay: Object.values(x.name).join(" "),
          name: L(x.name, locale),
          lat: x.lat!,
          lng: x.lng!,
          destinationSlug: x.destinationSlug,
          url: destUrl(x.destinationSlug),
          image: x.image ?? "",
          about: L(x.description, locale).slice(0, 160),
        })),
        ...places
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => ({ kind: p.kind as "hotel" | "restaurant", key: `${p.kind}:${p.slug}`, hay: placeHay(p), name: L(p.name, locale), lat: p.lat!, lng: p.lng!, destinationSlug: p.destinationSlug, url: placeUrl(p, locale), image: p.image ?? "", about: L(p.summary, locale).slice(0, 160), place: p })),
      ];
      let anchor: { name: string; lat: number; lng: number; key?: string } | null = null;
      if (a.near) {
        const best = points.map((pt) => ({ pt, s: textScore(pt.hay, a.near!) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s)[0];
        if (best) anchor = { name: best.pt.name, lat: best.pt.lat, lng: best.pt.lng, key: best.pt.key };
      }
      if (!anchor) {
        const slugs = destinationSlugs(`${a.destination ?? ""} ${a.near ?? ""}`);
        const d = dests.find((x) => slugs.has(x.slug));
        if (d) anchor = { name: L(d.name, locale), lat: d.lat, lng: d.lng };
      }
      if (!anchor) return { error: "location_unknown", note: "Ask the visitor which city or landmark they mean." };
      const near = points
        .filter((pt) => kinds.has(pt.kind) && pt.key !== anchor!.key)
        .map((pt) => ({ pt, km: distanceKm(anchor!, pt) }))
        .filter((x) => x.km <= 15)
        .sort((x, y) => x.km - y.km);
      const perKind = new Map<string, number>();
      const picked = near.filter(({ pt }) => {
        const n = perKind.get(pt.kind) ?? 0;
        perKind.set(pt.kind, n + 1);
        return n < 4;
      });
      for (const { pt } of picked) {
        if (pt.place) addPlaceCard(ctx, pt.place);
        else {
          ctx.sources.add(pt.key);
          ctx.cards.set(pt.key, {
            kind: "attraction",
            slug: pt.key.slice("attraction:".length),
            title: pt.name,
            url: pt.url,
            image: pt.image,
            meta: pt.about.slice(0, 60),
            trip: { id: pt.key, kind: "attraction", title: pt.name, destinationSlug: pt.destinationSlug ?? undefined, lat: pt.lat, lng: pt.lng, image: pt.image || undefined },
          });
        }
      }
      return {
        anchor: anchor.name,
        items: picked.map(({ pt, km }) => ({
          kind: pt.kind,
          name: pt.name,
          url: pt.url,
          about: pt.about,
          distanceKm: Math.round(km * 10) / 10,
          ...(km <= 2.5 ? { walk: `${Math.max(1, Math.round((km / 4.5) * 60))} min walk` } : {}),
        })),
        mapUrl: `/${locale}/navigator${picked[0]?.pt.destinationSlug ? `?destination=${picked[0].pt.destinationSlug}` : ""}`,
        note: "Straight-line distances; walking times are approximate.",
      };
    }
    case "get_phrases": {
      const a = args as z.infer<typeof schemas.get_phrases>;
      const topic: PhraseTopic | null = a.topic ?? (a.query ? guessPhraseTopic(a.query) : null);
      const topics: PhraseTopic[] = topic ? [topic] : ["greetings", "courtesy"];
      topics.forEach((t) => ctx.sources.add(`phrases:${t}`));
      return {
        items: topics.flatMap((t) => PHRASEBOOK[t].map((p) => ({ topic: t, english: p.en, uzbek: p.uz, russian: p.ru, pronunciationOfUzbek: p.say }))),
        note: "Checked phrasebook. Uzbek (Latin script) is the state language; Russian is widely understood in cities. If the exact phrase is missing, you may translate it yourself and say the translation is approximate.",
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

export type FallbackKind = "tour" | "hotel" | "restaurant" | "transport" | "phrases";

/** What a question is about, from keywords in any of the three languages (used when no AI provider answers). */
export function questionKind(question: string): FallbackKind {
  const q = norm(question);
  if (/(how do (i|you) say|translat|phrase|tarjima|qanday aytiladi|ибора|как сказать|перев)/.test(q)) return "phrases";
  if (/(hotel|hostel|guest ?house|stay|sleep|mehmonxona|otel|yotoq|tunash|отел|гостиниц|хостел|переноч|жиль)/.test(q)) return "hotel";
  if (/(restaurant|cafe|food|eat|dinner|lunch|breakfast|plov|restoran|kafe|ovqat|taom|tushlik|kechki|choyxona|ресторан|кафе|поесть|еда|ужин|обед|плов)/.test(q)) return "restaurant";
  if (/(train|flight|fly|bus|taxi|transfer|airport|metro|poyezd|reys|samolyot|avtobus|taksi|aeroport|поезд|рейс|самол|автобус|такси|трансфер|аэропорт|метро|transport|транспорт)/.test(q)) return "transport";
  return "tour";
}

/** Used by the non-AI fallback: plain catalogue search for a question, so the visitor still gets real results. */
export async function fallbackSearch(ctx: ToolContext, question: string): Promise<{ kind: FallbackKind; count: number }> {
  const kind = questionKind(question);
  const destination = aliasHits(question)[0];
  if (kind === "hotel" || kind === "restaurant") {
    const r = (await executeTool(ctx, "search_places", { kind, ...(destination ? { destination } : {}) })) as { items?: unknown[] };
    if (r.items?.length) return { kind, count: r.items.length };
  }
  if (kind === "transport") {
    const hits = aliasHits(question);
    const r = (hits.length >= 2
      ? await executeTool(ctx, "get_transport_options", { from: hits[0], to: hits[1] })
      : await executeTool(ctx, "search_places", { kind: "transport", ...(destination ? { destination } : {}) })) as { options?: unknown[]; items?: unknown[] };
    const n = r.options?.length ?? r.items?.length ?? 0;
    if (n) return { kind, count: n };
  }
  if (kind === "phrases") {
    const r = (await executeTool(ctx, "get_phrases", { query: question })) as { items?: unknown[] };
    return { kind, count: r.items?.length ?? 0 };
  }
  const r = (await executeTool(ctx, "search_tours", { query: question })) as { tours?: unknown[] };
  return { kind: "tour", count: r.tours?.length ?? 0 };
}

/** Plain-text phrase list for the fallback answer. */
export function phrasesAsText(question: string, locale: Locale): string {
  const topic = guessPhraseTopic(question) ?? "courtesy";
  // Uzbek visitors see the phrase without the English-style pronunciation hint.
  return PHRASEBOOK[topic].map((p) => `- ${locale === "ru" ? p.ru : p.en} — **${uzText(p.uz)}**${p.say && locale !== "uz" ? ` (${p.say})` : ""}`).join("\n");
}

