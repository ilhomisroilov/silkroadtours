import "server-only";
import type { Db } from "@/db/client";
import type { Locale } from "@/db/types";
import { DAILY_COST_USD, executeTool, type ToolContext } from "./tools";
import { uzDeep } from "@/lib/uz-alphabet";

export interface TripPlan {
  title: string;
  summary: string;
  days: { day: number; place: string; title: string; plan: string; transport: string | null; tourSlug: string | null }[];
  destinations: string[];
  suggestedTours: { slug: string; title: string; why: string; url?: string }[];
  budget: { low: number; high: number; currency: "USD"; note: string };
  accommodation: string;
  transport: string;
  bestSeason: string;
  food: string[];
  tips: string[];
  generatedBy: "ai" | "catalogue";
}

/** A plan as the visitor sees it: Uzbek text in the new alphabet, slugs and links untouched. Stored plans keep the original spelling. */
export function planForDisplay<T extends Partial<TripPlan>>(plan: T, locale: string): T {
  if (locale !== "uz" || !plan || typeof plan !== "object") return plan;
  const shown = uzDeep(plan);
  return {
    ...shown,
    destinations: plan.destinations,
    days: shown.days?.map((d, i) => ({ ...d, tourSlug: plan.days?.[i]?.tourSlug ?? null })),
    suggestedTours: shown.suggestedTours?.map((t, i) => ({ ...t, slug: plan.suggestedTours?.[i]?.slug ?? t.slug, url: plan.suggestedTours?.[i]?.url })),
  };
}

export function parsePlan(text: string): TripPlan | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const p = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(p.days) || !p.days.length) return null;
    return {
      title: String(p.title ?? ""),
      summary: String(p.summary ?? ""),
      days: p.days.slice(0, 21).map((d: Record<string, unknown>, i: number) => ({
        day: Number(d.day) || i + 1,
        place: String(d.place ?? ""),
        title: String(d.title ?? ""),
        plan: String(d.plan ?? ""),
        transport: d.transport ? String(d.transport) : null,
        tourSlug: typeof d.tourSlug === "string" && /^[a-z0-9-]+$/.test(d.tourSlug) ? d.tourSlug : null,
      })),
      destinations: Array.isArray(p.destinations) ? p.destinations.map(String).slice(0, 10) : [],
      suggestedTours: Array.isArray(p.suggestedTours)
        ? p.suggestedTours.slice(0, 5).map((t: Record<string, unknown>) => ({ slug: String(t.slug ?? ""), title: String(t.title ?? ""), why: String(t.why ?? "") }))
        : [],
      budget: {
        low: Number(p.budget?.low) || 0,
        high: Number(p.budget?.high) || 0,
        currency: "USD",
        note: String(p.budget?.note ?? ""),
      },
      accommodation: String(p.accommodation ?? ""),
      transport: String(p.transport ?? ""),
      bestSeason: String(p.bestSeason ?? ""),
      food: Array.isArray(p.food) ? p.food.map(String).slice(0, 8) : [],
      tips: Array.isArray(p.tips) ? p.tips.map(String).slice(0, 8) : [],
      generatedBy: "ai",
    };
  } catch {
    return null;
  }
}

/** Drops any tour the model mentioned that is not actually published (never recommend unavailable tours). */
export async function verifyPlanTours(db: Db, locale: Locale, plan: TripPlan): Promise<TripPlan> {
  const ctx: ToolContext = { db, locale, conversationId: null, sources: new Set(), cards: new Map() };
  const valid = new Map<string, string>();
  for (const slug of new Set([...plan.suggestedTours.map((t) => t.slug), ...plan.days.map((d) => d.tourSlug).filter(Boolean) as string[]])) {
    const r = (await executeTool(ctx, "get_tour_details", { slug })) as { url?: string; error?: string };
    if (!r.error && r.url) valid.set(slug, r.url);
  }
  return {
    ...plan,
    days: plan.days.map((d) => ({ ...d, tourSlug: d.tourSlug && valid.has(d.tourSlug) ? d.tourSlug : null })),
    suggestedTours: plan.suggestedTours.filter((t) => valid.has(t.slug)).map((t) => ({ ...t, url: valid.get(t.slug) })),
  };
}

const T = {
  en: { title: (d: number) => `${d} days in Uzbekistan`, free: "Free time / independent sightseeing", note: "Estimate from our indicative tour prices plus typical daily costs. Not a confirmed price.", acc: "Boutique 3★ hotels and family guesthouses", tr: "Afrosiyob high-speed train between Tashkent, Samarkand and Bukhara; car or flight for Khiva", season: "April–May and September–October", tips: ["Book Afrosiyob trains early in spring and autumn.", "Carry some cash (so‘m) for bazaars.", "Cover shoulders and knees in mosques and madrasas."], food: ["Plov", "Samsa from a tandir", "Shashlik", "Non bread"], summary: "Built from our catalogue because the AI planner is unavailable right now." },
  uz: { title: (d: number) => `Oʻzbekistonda ${d} kun`, free: "Erkin vaqt / mustaqil sayr", note: "Turlarning taxminiy narxi va odatiy kunlik xarajatlar asosida hisoblangan taxmin. Tasdiqlangan narx emas.", acc: "Butik 3★ mehmonxonalar va oilaviy mehmon uylari", tr: "Toshkent, Samarqand va Buxoro oraligʻida Afrosiyob tezyurar poyezdi; Xivaga mashina yoki samolyot", season: "Aprel–may va sentyabr–oktyabr", tips: ["Bahor va kuzda Afrosiyob chiptalarini oldindan oling.", "Bozorlar uchun naqd soʻm olib yuring.", "Masjid va madrasalarda yelka va tizzalar yopiq boʻlsin."], food: ["Palov", "Tandir somsa", "Shashlik", "Non"], summary: "AI rejalashtiruvchi hozir ishlamayapti, shu sabab reja katalogimiz asosida tuzildi." },
  ru: { title: (d: number) => `${d} дней в Узбекистане`, free: "Свободное время / самостоятельные прогулки", note: "Оценка по ориентировочным ценам туров и типичным дневным расходам. Не подтверждённая цена.", acc: "Бутик-отели 3★ и семейные гостевые дома", tr: "Скоростной поезд «Афросиаб» между Ташкентом, Самаркандом и Бухарой; в Хиву — машина или самолёт", season: "Апрель–май и сентябрь–октябрь", tips: ["Билеты на «Афросиаб» весной и осенью покупайте заранее.", "Возьмите наличные сумы для базаров.", "В мечетях и медресе закрывайте плечи и колени."], food: ["Плов", "Самса из тандыра", "Шашлык", "Лепёшка"], summary: "ИИ-планировщик сейчас недоступен, поэтому план составлен по нашему каталогу." },
} as const;

/** Deterministic, database-only planner used when no AI provider is available. */
export async function cataloguePlan(db: Db, locale: Locale, request: string, days: number, budgetUsd?: number): Promise<TripPlan> {
  const t = T[locale];
  const ctx: ToolContext = { db, locale, conversationId: null, sources: new Set(), cards: new Map() };
  const found = (await executeTool(ctx, "search_tours", { query: request, maxDays: days, maxPriceUsd: budgetUsd })) as {
    tours: { slug: string; title: string; days: number; indicativeFromPriceUsdPerPerson: number; summary: string; destinations: string[] }[];
  };
  const chosen: typeof found.tours = [];
  let used = 0;
  for (const tour of found.tours ?? []) {
    if (used + tour.days > days) continue;
    chosen.push(tour);
    used += tour.days;
    if (chosen.length >= 2) break;
  }
  const dayList: TripPlan["days"] = [];
  for (const tour of chosen) {
    const detail = (await executeTool(ctx, "get_tour_details", { slug: tour.slug })) as { itinerary?: { day: number; title: string; description: string }[] };
    for (const d of detail.itinerary ?? []) dayList.push({ day: dayList.length + 1, place: tour.title, title: d.title, plan: d.description, transport: null, tourSlug: tour.slug });
  }
  while (dayList.length < days) dayList.push({ day: dayList.length + 1, place: "", title: t.free, plan: "", transport: null, tourSlug: null });
  const budget = (await executeTool(ctx, "calculate_trip_budget", { days, tourSlugs: chosen.map((c) => c.slug) })) as { perPersonEstimate: { low: number; high: number } };
  return {
    title: t.title(days),
    summary: t.summary,
    days: dayList.slice(0, days),
    destinations: [...new Set(chosen.flatMap((c) => c.destinations))],
    suggestedTours: chosen.map((c) => ({ slug: c.slug, title: c.title, why: c.summary.slice(0, 140), url: `/${locale}/tours/${c.slug}` })),
    budget: { low: budget.perPersonEstimate.low, high: budget.perPersonEstimate.high, currency: "USD", note: t.note },
    accommodation: t.acc,
    transport: t.tr,
    bestSeason: t.season,
    food: [...t.food],
    tips: [...t.tips],
    generatedBy: "catalogue",
  };
}

export { DAILY_COST_USD };
