import type { PublicPartner } from "@/db/queries/partners";
import type { Currency, ExchangeRates, Locale } from "@/db/types";
import { slugify, type PartnerService } from "@/lib/partners";
import { formatUsdIn } from "@/lib/pricing";
import type { PartnerCardData } from "./partner-card";

type T = { (key: string, values?: Record<string, string | number>): string };

export interface PriceContext {
  currency: Currency;
  rates: ExchangeRates;
  locale: Locale;
}

/** "from 540 000 so'm per night" / "Price on request" in the visitor's language and currency. */
export function servicePrice(t: T, s: PartnerService, ctx: PriceContext): string {
  if (s.priceFromUsd == null) return t("onRequest");
  const price = formatUsdIn(s.priceFromUsd, ctx.currency, ctx.rates, ctx.locale);
  return s.unit ? t("fromUnit", { price, unit: t(`units.${s.unit}`) }) : t("from", { price });
}

/** City label: the destination name in the visitor's language when known, otherwise the city as entered. */
export function partnerCity(p: Pick<PublicPartner, "city" | "destinationSlug">, destName: Map<string, string>): string | null {
  const dest = p.destinationSlug ? destName.get(p.destinationSlug) : undefined;
  if (!dest) return p.city ?? null;
  const city = slugify(p.city ?? "");
  // "Bukhara" for destination "bukhara", "Fergana" for "fergana-valley": show the translated destination name.
  if (!city || p.destinationSlug!.startsWith(city) || city.startsWith(p.destinationSlug!)) return dest;
  return p.city;
}

export function toCardData(t: T, p: PublicPartner, destName: Map<string, string>, ctx: PriceContext): PartnerCardData {
  return {
    slug: p.slug,
    businessName: p.businessName,
    typeLabel: t(`types.${p.type}`),
    city: partnerCity(p, destName),
    description: p.description,
    highlights: p.services.slice(0, 2).map((s) => ({ name: s.name, price: servicePrice(t, s, ctx) })),
  };
}
