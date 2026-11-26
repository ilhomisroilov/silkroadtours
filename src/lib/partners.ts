// Partner ecosystem helpers shared by the site, the admin panel and the seed scripts (no server-only imports).
import type { PartnerStatus, PartnerType, PlaceKind } from "../db/types";

export const PARTNER_TYPE_LIST: readonly PartnerType[] = ["hotel", "restaurant", "transport", "tour_operator", "guide", "museum", "attraction", "experience"];
export const PARTNER_STATUS_LIST: readonly PartnerStatus[] = ["pending", "approved", "rejected"];

/** Billing units a partner can attach to an indicative "from" price. */
export const SERVICE_UNITS = ["night", "person", "group", "vehicle", "trip", "day", "hour", "meal", "ticket"] as const;
export type ServiceUnit = (typeof SERVICE_UNITS)[number];

export interface PartnerService {
  name: string;
  /** Indicative "from" price in whole USD; null = on request. */
  priceFromUsd: number | null;
  unit: ServiceUnit | null;
}

/**
 * Services are stored in partners.services (a string array) as readable lines:
 *   "Double room — from $45 / night", "Airport pick-up — from $20", "Tasting menu".
 * These helpers turn the lines into structured items and back.
 */
export function formatService(s: PartnerService): string {
  const name = s.name.replace(/\s+/g, " ").trim();
  if (s.priceFromUsd == null) return name;
  return `${name} — from $${Math.round(s.priceFromUsd)}${s.unit ? ` / ${s.unit}` : ""}`;
}

const LINE_RE = /^(.*?)\s+(?:—|-|–)\s+from \$(\d{1,6})(?:\s*\/\s*([a-z_]+))?\s*$/i;
const LEGACY_RE = /^(.*?)\s+from \$(\d{1,6})\s*$/i;

export function parseService(line: string): PartnerService {
  const m = LINE_RE.exec(line);
  if (m) {
    const unit = (m[3]?.toLowerCase() ?? null) as ServiceUnit | null;
    return { name: m[1]!.trim(), priceFromUsd: Number(m[2]), unit: unit && (SERVICE_UNITS as readonly string[]).includes(unit) ? unit : null };
  }
  const l = LEGACY_RE.exec(line);
  if (l) return { name: l[1]!.trim(), priceFromUsd: Number(l[2]), unit: null };
  return { name: line.trim(), priceFromUsd: null, unit: null };
}

export const parseServices = (lines: readonly string[]): PartnerService[] => lines.map(parseService).filter((s) => s.name);

/** Partner references: "PA-" followed by letters and digits (new applications use 6 characters). */
export const PARTNER_REFERENCE_RE = /^PA-[A-Z0-9]{2,12}(?:-[A-Z0-9]{2,12})?$/;

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o", ф: "f", х: "kh", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** URL slug for a business name (Latin, Uzbek apostrophes and Cyrillic are handled). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼ'`’‘&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Paths under /partners that are pages of their own, never a partner profile. */
const RESERVED = new Set(["apply", "dashboard", "join", "new"]);

/**
 * Public profile slugs for a set of partners: the business name, made unique with the reference when two
 * names collide (or the name has no Latin letters at all).
 */
export function assignPartnerSlugs<T extends { id: number; businessName: string; reference: string }>(rows: readonly T[]): Map<number, string> {
  const base = new Map<number, string>();
  const seen = new Map<string, number>();
  for (const r of rows) {
    const s = slugify(r.businessName);
    base.set(r.id, s);
    seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const out = new Map<number, string>();
  for (const r of rows) {
    const s = base.get(r.id)!;
    const unique = s.length >= 2 && !RESERVED.has(s) && seen.get(s) === 1;
    out.set(r.id, unique ? s : [s, r.reference.toLowerCase()].filter(Boolean).join("-"));
  }
  return out;
}

/** Two-letter monogram for a business name ("Indigo Lantern Guesthouse" → "IL"). */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(the|and|of|&|by)$/i.test(w));
  const letters = (words.length >= 2 ? [words[0]![0], words[1]![0]] : [words[0]?.[0], words[0]?.[1]]).filter(Boolean).join("");
  return (letters || "NT").toUpperCase();
}

/** Inquiries about a partner's own profile use this refSlug (stable even when the name changes). */
export const partnerRefSlug = (reference: string) => reference.toLowerCase();

/** Where a place's public page lives. */
export function placeHref(kind: PlaceKind, slug: string): string {
  // Transport options have no page of their own; they are compared on the flights & trains search.
  if (kind === "transport") return "/transport";
  return `/${kind === "hotel" ? "hotels" : "restaurants"}/${slug}`;
}

/** First name only, for showing an inquiry to a partner without the customer's personal data. */
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
