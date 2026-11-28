/**
 * Extended Gulistan Travel catalogue: drafted content in scripts/seed-data/generated/*.json, mapped to the
 * seed types and checked by build-seed-sql.ts like the hand-written entries.
 */
import { existsSync, readFileSync } from "node:fs";
import type { AccommodationItem, Difficulty, LocalizedText, RoutePoint, TourBadge, TourCategory, TransportItem } from "../../src/db/types.ts";
import { EXC, INC, L, type SeedDay, type SeedTier } from "./common.ts";
import type { SeedDestination } from "./destinations.ts";
import type { SeedFaq } from "./faq.ts";
import type { SeedTour } from "./tours-inbound.ts";

const dir = new URL("./generated/", import.meta.url);
const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(name, dir), "utf8")) as T;

// ── Destinations ───────────────────────────────────────────────────────────

type GenDestination = SeedDestination & { country: LocalizedText | null };
export const extraDestinations: (SeedDestination & { country?: LocalizedText | null })[] = load<GenDestination[]>("destinations.json").map(
  (d) => ({ ...d, attractions: d.attractions.map(({ name, description, lat, lng }) => ({ name, description, lat, lng })) }),
);

// ── Tours ──────────────────────────────────────────────────────────────────

const INC_EXTRA: Record<string, LocalizedText> = {
  camel: L("Camel ride", "Tuyada sayr", "Прогулка на верблюде"),
  dinner: L("Dinners as listed", "Dasturdagi kechki ovqatlar", "Ужины по программе"),
  transport: L("All transport in the programme", "Dasturdagi barcha transport", "Весь транспорт по программе"),
};
const EXC_EXTRA: Record<string, LocalizedText> = {
  dinner: L("Dinners unless listed", "Koʻrsatilmagan kechki ovqatlar", "Ужины, если не указаны"),
};

interface GenTour {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  difficulty: Difficulty;
  minGroup: number;
  maxGroup: number;
  childPricePercent: number;
  badges: TourBadge[];
  includedKeys: string[];
  excludedKeys: string[];
  accommodation: AccommodationItem[];
  transport: TransportItem[];
  route: RoutePoint[];
  seasonMonths: number[];
  tiers: SeedTier[];
  itinerary: { title: LocalizedText; description: LocalizedText; meals: ("B" | "L" | "D")[]; overnight?: LocalizedText }[];
}

const BRIEF: Record<string, { audience: "inbound" | "domestic"; category: TourCategory; destinations: string[]; currency: "USD" | "UZS"; featured?: boolean; languages: string[] }> = {
  "nuratau-aydarkul-yurt-safari": { audience: "inbound", category: "yurt_camp", destinations: ["aydarkul", "nuratau", "samarkand"], currency: "USD", languages: ["en", "ru", "uz"] },
  "termez-buddhist-heritage-4-days": { audience: "inbound", category: "cultural", destinations: ["termez", "boysun"], currency: "USD", languages: ["en", "ru", "uz"] },
  "fergana-silk-and-ceramics-masters": { audience: "inbound", category: "cultural", destinations: ["margilan", "kokand", "fergana-valley"], currency: "USD", languages: ["en", "ru", "uz"] },
  "karakalpakstan-savitsky-and-desert-fortresses": { audience: "inbound", category: "cultural", destinations: ["nukus", "karakalpakstan-aral", "khiva"], currency: "USD", languages: ["en", "ru", "uz"] },
  "grand-uzbekistan-12-days": { audience: "inbound", category: "cultural", destinations: ["tashkent", "samarkand", "bukhara", "khiva", "nukus", "shakhrisabz", "fergana-valley"], currency: "USD", featured: true, languages: ["en", "ru", "uz"] },
  "samarkand-bukhara-family-5-days": { audience: "inbound", category: "family", destinations: ["samarkand", "bukhara"], currency: "USD", languages: ["en", "ru", "uz"] },
  "sarmishsay-petroglyphs-and-nurata-weekend": { audience: "domestic", category: "eco", destinations: ["sarmishsay", "nuratau"], currency: "UZS", languages: ["uz", "ru"] },
  "dubai-city-and-desert-5-days": { audience: "domestic", category: "city", destinations: ["dubai"], currency: "USD", featured: true, languages: ["uz", "ru"] },
  "istanbul-bosphorus-and-old-city-5-days": { audience: "domestic", category: "city", destinations: ["istanbul"], currency: "USD", featured: true, languages: ["uz", "ru"] },
};

const ACC_TYPES = new Set(["yurt_camp", "guesthouse", "homestay", "boutique_hotel", "hotel", "resort", "tent"]);

export const extraTours: SeedTour[] = load<GenTour[]>("tours.json").flatMap((g): SeedTour[] => {
  const b = BRIEF[g.slug];
  if (!b) return [];
  const days = g.itinerary.length;
  const included = g.includedKeys.map((k) => (INC as Record<string, LocalizedText>)[k] ?? INC_EXTRA[k]).filter((x): x is LocalizedText => !!x);
  const excluded = g.excludedKeys.map((k) => (EXC as Record<string, LocalizedText>)[k] ?? EXC_EXTRA[k]).filter((x): x is LocalizedText => !!x);
  const maxGroup = Math.max(g.maxGroup, ...g.tiers.map((t) => t.maxPax));
  const itinerary: SeedDay[] = g.itinerary.map((d, i) => ({
    title: d.title,
    description: d.description,
    meals: d.meals.filter((m) => m === "B" || m === "L" || m === "D"),
    ...(d.overnight && i < days - 1 ? { overnight: d.overnight } : {}),
  }));
  const hasGroup = g.tiers.some((t) => t.bookingType === "group");
  return [
    {
      slug: g.slug,
      audience: b.audience,
      category: b.category,
      destinations: b.destinations,
      durationDays: days,
      durationNights: Math.max(0, days - 1),
      difficulty: g.difficulty,
      minGroup: 1,
      maxGroup,
      baseCurrency: b.currency,
      childPricePercent: Math.min(90, Math.max(40, g.childPricePercent)),
      badges: g.badges.filter((x) => ["best_seller", "eco_camp", "weekend_trip", "new", "family_friendly", "small_group", "discount"].includes(x)).slice(0, 2),
      featured: b.featured ?? false,
      title: g.title,
      summary: g.summary,
      description: g.description,
      included,
      excluded,
      accommodation: g.accommodation.filter((a) => ACC_TYPES.has(a.type)),
      transport: g.transport,
      route: g.route,
      guideLanguages: b.languages,
      seasonMonths: g.seasonMonths,
      tiers: g.tiers,
      ...(hasGroup ? { departures: { weekday: 6, everyWeeks: 2, count: 10 } } : {}),
      itinerary,
    },
  ];
});

// ── FAQ ────────────────────────────────────────────────────────────────────

export const extraFaq: SeedFaq[] = [
  ...load<SeedFaq[]>("faq.json"),
  {
    category: "general",
    question: L(
      "Do you also arrange trips abroad, for example to Dubai or Istanbul?",
      "Xorijga, masalan Dubay yoki Istanbulga sayohat ham tashkil qilasizmi?",
      "Организуете ли вы поездки за рубеж, например в Дубай или Стамбул?",
    ),
    answer: L(
      "Yes. For residents of Uzbekistan we arrange packages to Dubai and Istanbul with hotel, transfers and excursions. Flights and visa requirements depend on your dates and passport, so we confirm the full price and documents in writing.",
      "Ha. Oʻzbekiston aholisi uchun Dubay va Istanbulga mehmonxona, transfer va ekskursiyalar bilan paketlar tashkil qilamiz. Aviachipta va viza talablari sanalar va pasportingizga bogʻliq, shuning uchun toʻliq narx va hujjatlarni yozma tasdiqlaymiz.",
      "Да. Для жителей Узбекистана мы организуем пакеты в Дубай и Стамбул с отелем, трансферами и экскурсиями. Перелёт и визовые требования зависят от дат и паспорта, поэтому полную цену и документы мы подтверждаем письменно.",
    ),
  },
  {
    category: "general",
    question: L(
      "Are the prices from the AI trip planner final?",
      "AI rejalashtiruvchi koʻrsatgan narxlar yakuniymi?",
      "Окончательны ли цены из ИИ-планировщика?",
    ),
    answer: L(
      "No. The planner uses indicative prices from our catalogue to estimate a budget. Our team checks availability and confirms the final price in writing before you pay anything.",
      "Yoʻq. Rejalashtiruvchi byudjetni hisoblash uchun katalogimizdagi taxminiy narxlardan foydalanadi. Jamoamiz joylar mavjudligini tekshiradi va hech qanday toʻlovdan oldin yakuniy narxni yozma tasdiqlaydi.",
      "Нет. Планировщик использует ориентировочные цены из нашего каталога для оценки бюджета. Наша команда проверяет наличие мест и письменно подтверждает итоговую цену до любой оплаты.",
    ),
  },
];

// ── CMS content ────────────────────────────────────────────────────────────

export interface SeedContent {
  kind: "guide" | "experience" | "service";
  slug: string;
  category: string | null;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  image: string | null;
  destinationSlug: string | null;
  icon: string | null;
  requestType: string | null;
  durationHours: number | null;
  priceFromUsd: number | null;
  readingMinutes: number | null;
}

/** A photo of the activity itself when we have one (public/images/experiences/<slug>.jpg), else a photo of the place. */
const EXPERIENCE_PLACE_IMAGE: Record<string, string> = {
  "plov-cooking-class-tashkent": "/images/destinations/tashkent/2.jpg",
  "bread-baking-samarkand": "/images/destinations/samarkand/1.jpg",
  "paper-making-konigil": "/images/destinations/samarkand/hero.jpg",
  "registan-night-photo-walk": "/images/destinations/samarkand/4.jpg",
  "bukhara-hammam-and-spice-trail": "/images/destinations/bukhara/2.jpg",
  "suzani-embroidery-workshop-bukhara": "/images/destinations/bukhara/3.jpg",
  "khiva-sunset-on-the-walls": "/images/destinations/khiva/4.jpg",
  "camel-ride-aydarkul": "/images/destinations/aydarkul/hero.jpg",
  "rishtan-ceramics-masterclass": "/images/destinations/fergana-valley/hero.jpg",
  "margilan-ikat-silk-weaving": "/images/destinations/fergana-valley/3.jpg",
  "savitsky-museum-private-tour": "/images/destinations/karakalpakstan-aral/1.jpg",
  "chimgan-horse-riding": "/images/destinations/chimgan-charvak/4.jpg",
  "zaamin-juniper-forest-hike": "/images/destinations/zaamin/hero.jpg",
  "termez-buddhist-sites-day": "/images/destinations/termez/hero.jpg",
  "nurata-village-homestay-evening": "/images/destinations/nuratau/hero.jpg",
};
const publicDir = new URL("../../public/", import.meta.url);
const experienceImage = (slug: string, i: number): string =>
  existsSync(new URL(`images/experiences/${slug}.jpg`, publicDir))
    ? `/images/experiences/${slug}.jpg`
    : (EXPERIENCE_PLACE_IMAGE[slug] ?? `/images/destinations/samarkand/${(i % 4) + 1}.jpg`);

export const extraContent: SeedContent[] = [
  ...load<(Omit<SeedContent, "kind" | "destinationSlug" | "icon" | "requestType" | "durationHours" | "priceFromUsd"> & { image: string })[]>("guides.json").map(
    (g): SeedContent => ({
      kind: "guide",
      slug: g.slug,
      category: g.category,
      title: g.title,
      excerpt: g.excerpt,
      body: g.body,
      image: g.image,
      destinationSlug: null,
      icon: null,
      requestType: null,
      durationHours: null,
      priceFromUsd: null,
      readingMinutes: g.readingMinutes,
    }),
  ),
  ...load<{ slug: string; destination: string; title: LocalizedText; summary: LocalizedText; body: LocalizedText; durationHours: number; priceFromUsd: number; category: string }[]>(
    "experiences.json",
  ).map(
    (e, i): SeedContent => ({
      kind: "experience",
      slug: e.slug,
      category: e.category,
      title: e.title,
      excerpt: e.summary,
      body: e.body,
      image: experienceImage(e.slug, i),
      destinationSlug: e.destination,
      icon: null,
      requestType: null,
      durationHours: e.durationHours,
      priceFromUsd: Math.round(e.priceFromUsd),
      readingMinutes: null,
    }),
  ),
  ...load<{ slug: string; icon: string; title: LocalizedText; summary: LocalizedText; body: LocalizedText; requestType: string }[]>("services.json").map(
    (s): SeedContent => ({
      kind: "service",
      slug: s.slug,
      category: null,
      title: s.title,
      excerpt: s.summary,
      body: s.body,
      image: null,
      destinationSlug: null,
      icon: s.icon,
      // Services with their own form keep it; the rest are sent as a general inquiry about the service.
      requestType: ["airport_transfer", "accommodation", "guide"].includes(s.requestType) ? s.requestType : s.slug === "photo-tour-arrangements" ? "custom_tour" : "inquiry",
      durationHours: null,
      priceFromUsd: null,
      readingMinutes: null,
    }),
  ),
];

// ── Sample reviews (admin-only, never shown publicly) ─────────────────────

export interface SeedSampleReview {
  tour: string;
  authorName: string;
  authorCountry: string;
  rating: number;
  title: string;
  body: string;
  language: string;
  travelMonth: string;
}

export const sampleReviews: SeedSampleReview[] = load<
  { tour: string; authorName: string; authorCountry: string; rating: number; title: LocalizedText | string; body: LocalizedText | string; language: string; travelMonth: string }[]
>("reviews.json").map((r) => {
  const lang = (["en", "uz", "ru"].includes(r.language) ? r.language : "en") as "en" | "uz" | "ru";
  const pick = (v: LocalizedText | string) => (typeof v === "string" ? v : v[lang] || v.en);
  return { ...r, language: lang, title: pick(r.title), body: pick(r.body), rating: Math.min(5, Math.max(1, Math.round(r.rating))) };
});
