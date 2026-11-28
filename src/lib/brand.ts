/**
 * One codebase, several brands. Each deployment picks its brand with NEXT_PUBLIC_BRAND (build argument and
 * runtime env): "national" → National Tours (nationaltours.uz, the default so an existing server keeps its
 * name), "gulistan" → Guliston Travel (gulistantravel.uz).
 *
 * Texts in messages/*.json and the seed data are written with the canonical name "Guliston Travel";
 * brandText()/brandDeep() swap it for the active brand at load time.
 * Keep scripts/brand.mjs (used by db.mjs and the seed builder) in sync with this file.
 */
export type BrandId = "national" | "gulistan";

export interface Brand {
  id: BrandId;
  name: string;
  domain: string;
  /** Public contact address shown when the admin has not set one; "" hides it. */
  email: string;
  slogan: string;
  logo: {
    /** White lettering, for the dark glass header. */
    header: { src: string; width: number; height: number };
    /** White lettering with the slogan, for the footer. */
    footer: { src: string; width: number; height: number };
    /** Logo on transparent background as PNG (search engines, documents). */
    png: string;
    /** Square lockup (emblem above the name) rather than a wide one: drawn taller in the header. */
    stacked: boolean;
  };
  icon: string;
  appleIcon: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  national: {
    id: "national",
    name: "National Tours",
    domain: "nationaltours.uz",
    email: "",
    slogan: "Your journey. One platform.",
    logo: {
      header: { src: "/brand/national-tours-header-light.webp", width: 439, height: 168 },
      footer: { src: "/brand/national-tours-logo-light.webp", width: 720, height: 276 },
      png: "/brand/national-tours-logo.png",
      stacked: false,
    },
    icon: "/icon.png",
    appleIcon: "/apple-icon.png",
  },
  gulistan: {
    id: "gulistan",
    name: "Guliston Travel",
    domain: "gulistantravel.uz",
    email: "info@gulistantravel.uz",
    slogan: "Your journey. One platform.",
    logo: {
      // Final artwork from the owner (2026-11-28), source: scripts/brand/gulistan-travel-source.png
      header: { src: "/brand/gulistan-travel-logo.webp", width: 428, height: 320 },
      footer: { src: "/brand/gulistan-travel-logo.webp", width: 428, height: 320 },
      png: "/brand/gulistan-travel-logo.png",
      stacked: true,
    },
    icon: "/brand/gulistan-travel-icon.png",
    appleIcon: "/brand/gulistan-travel-apple-icon.png",
  },
};

export const CANONICAL_NAME = "Guliston Travel";
const CANONICAL_DOMAIN = "gulistantravel.uz";

export function resolveBrandId(value: string | undefined): BrandId {
  return value === "gulistan" ? "gulistan" : "national";
}

export const BRAND: Brand = BRANDS[resolveBrandId(process.env.NEXT_PUBLIC_BRAND)];

/** Replaces the canonical brand name and domain with the active brand's. */
export function brandText(text: string, brand: Brand = BRAND): string {
  if (brand.name === CANONICAL_NAME) return text;
  return text.replaceAll(CANONICAL_NAME, brand.name).replaceAll(CANONICAL_DOMAIN, brand.domain);
}

/** brandText over every string of a message tree. */
export function brandDeep<T>(value: T, brand: Brand = BRAND): T {
  if (brand.name === CANONICAL_NAME) return value;
  if (typeof value === "string") return brandText(value, brand) as T;
  if (Array.isArray(value)) return value.map((v) => brandDeep(v, brand)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, brandDeep(v, brand)])) as T;
  }
  return value;
}
