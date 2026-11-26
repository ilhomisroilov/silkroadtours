// Pricing & currency engine. Pure functions, used identically on the server
// (authoritative quote stored with each booking) and in the client price card.

import type {
  BookingType,
  Currency,
  DepartureStatus,
  ExchangeRates,
  Locale,
} from "../db/types";

/** Digits after the decimal point for each currency's minor unit. */
export const CURRENCY_EXPONENT: Record<Currency, number> = { USD: 2, EUR: 2, UZS: 0 };

/** Converted prices are rounded to a clean step (whole dollars/euros, 1,000 so'm). */
const DISPLAY_STEP_MINOR: Record<Currency, number> = { USD: 100, EUR: 100, UZS: 1000 };

export type PricingErrorCode = "missing_rate" | "missing_base_price" | "invalid_amount";

export class PricingError extends Error {
  readonly code: PricingErrorCode;
  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}

export function toMajor(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCY_EXPONENT[currency];
}

export function toMinor(amountMajor: number, currency: Currency): number {
  return Math.round(amountMajor * 10 ** CURRENCY_EXPONENT[currency]);
}

function rateOf(rates: ExchangeRates, currency: Currency): number {
  const r = rates.rates[currency];
  if (!Number.isFinite(r) || r <= 0) {
    throw new PricingError("missing_rate", `No valid exchange rate for ${currency}`);
  }
  return r;
}

/** Exact conversion between minor units through the USD base. */
export function convertMinor(
  amountMinor: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRates,
): number {
  if (!Number.isFinite(amountMinor)) throw new PricingError("invalid_amount", "Amount is not finite");
  if (from === to) return Math.round(amountMinor);
  const usd = toMajor(amountMinor, from) / rateOf(rates, from);
  return toMinor(usd * rateOf(rates, to), to);
}

export function roundToDisplayStep(amountMinor: number, currency: Currency): number {
  const step = DISPLAY_STEP_MINOR[currency];
  return Math.round(amountMinor / step) * step;
}

// ── Formatting ─────────────────────────────────────────────────────────────

const INTL_LOCALE: Record<Locale, string> = { en: "en-US", uz: "uz-Latn-UZ", ru: "ru-RU" };
const UZS_SUFFIX: Record<Locale, string> = { en: "UZS", uz: "so'm", ru: "сум" };

export function formatMoney(amountMinor: number, currency: Currency, locale: Locale): string {
  const major = toMajor(amountMinor, currency);
  const fractionDigits = Number.isInteger(major) ? 0 : CURRENCY_EXPONENT[currency];
  if (currency === "UZS") {
    const n = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(major);
    return `${n} ${UZS_SUFFIX[locale]}`;
  }
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major);
}

// ── Tier prices ────────────────────────────────────────────────────────────

export interface TierPrices {
  priceUsd: number | null;
  priceUzs: number | null;
  priceEur: number | null;
}

export interface PriceTierLike extends TierPrices {
  bookingType: BookingType;
  minPax: number;
  maxPax: number;
}

function explicitPrice(tier: TierPrices, currency: Currency): number | null {
  switch (currency) {
    case "USD":
      return tier.priceUsd;
    case "UZS":
      return tier.priceUzs;
    case "EUR":
      return tier.priceEur;
  }
}

/**
 * Per-person price of a tier in the requested currency.
 * Uses the agency's manual override when present, else converts from the base-currency price.
 */
export function tierPriceIn(
  tier: TierPrices,
  currency: Currency,
  baseCurrency: Currency,
  rates: ExchangeRates,
): { amountMinor: number; isConverted: boolean } {
  const direct = explicitPrice(tier, currency);
  if (direct != null) return { amountMinor: direct, isConverted: false };

  const base = explicitPrice(tier, baseCurrency);
  if (base == null) {
    throw new PricingError("missing_base_price", `Tier has no ${baseCurrency} (base currency) price`);
  }
  return {
    amountMinor: roundToDisplayStep(convertMinor(base, baseCurrency, currency, rates), currency),
    isConverted: true,
  };
}

/** The tier whose [minPax, maxPax] contains the group size for this booking type. */
export function findTier<T extends PriceTierLike>(
  tiers: readonly T[],
  bookingType: BookingType,
  pax: number,
): T | undefined {
  return tiers
    .filter((t) => t.bookingType === bookingType && pax >= t.minPax && pax <= t.maxPax)
    .sort((a, b) => b.minPax - a.minPax)[0];
}

/** Lowest per-person price across all tiers, in base currency minor units (for "from $X" cards). */
export function lowestBasePrice(tiers: readonly PriceTierLike[], baseCurrency: Currency): number | null {
  const prices = tiers
    .map((t) => explicitPrice(t, baseCurrency))
    .filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}

// ── Quote ──────────────────────────────────────────────────────────────────

export interface QuoteInput {
  tour: {
    baseCurrency: Currency;
    childPricePercent: number;
    minGroup: number;
    maxGroup: number;
  };
  tiers: readonly PriceTierLike[];
  bookingType: BookingType;
  adults: number;
  children: number;
  currency: Currency;
  rates: ExchangeRates;
  departure?: {
    status: DepartureStatus;
    seatsTotal: number;
    seatsBooked: number;
    priceModifierPercent: number;
  } | null;
}

export type QuoteFailure =
  | "invalid_party"
  | "group_too_small"
  | "group_too_large"
  | "no_tier"
  | "departure_unavailable"
  | "insufficient_seats";

export type QuoteResult =
  | {
      ok: true;
      currency: Currency;
      pax: number;
      perAdultMinor: number;
      perChildMinor: number;
      adultsSubtotalMinor: number;
      childrenSubtotalMinor: number;
      totalMinor: number;
      /** Normalised total for analytics. */
      totalUsdCents: number;
      tier: { minPax: number; maxPax: number; bookingType: BookingType };
      priceModifierPercent: number;
      isConverted: boolean;
    }
  | { ok: false; reason: QuoteFailure };

export function quote(input: QuoteInput): QuoteResult {
  const { tour, tiers, bookingType, adults, children, currency, rates, departure } = input;

  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 1 || children < 0) {
    return { ok: false, reason: "invalid_party" };
  }
  const pax = adults + children;
  if (pax < tour.minGroup) return { ok: false, reason: "group_too_small" };
  if (pax > tour.maxGroup) return { ok: false, reason: "group_too_large" };

  if (departure) {
    if (departure.status === "cancelled" || departure.status === "sold_out") {
      return { ok: false, reason: "departure_unavailable" };
    }
    if (departure.seatsTotal - departure.seatsBooked < pax) {
      return { ok: false, reason: "insufficient_seats" };
    }
  }

  const tier = findTier(tiers, bookingType, pax);
  if (!tier) return { ok: false, reason: "no_tier" };

  const { amountMinor: tierPrice, isConverted } = tierPriceIn(tier, currency, tour.baseCurrency, rates);
  const modifier = departure?.priceModifierPercent ?? 0;

  const perAdultMinor = roundToDisplayStep((tierPrice * (100 + modifier)) / 100, currency);
  const perChildMinor = roundToDisplayStep((perAdultMinor * tour.childPricePercent) / 100, currency);
  const adultsSubtotalMinor = perAdultMinor * adults;
  const childrenSubtotalMinor = perChildMinor * children;
  const totalMinor = adultsSubtotalMinor + childrenSubtotalMinor;

  return {
    ok: true,
    currency,
    pax,
    perAdultMinor,
    perChildMinor,
    adultsSubtotalMinor,
    childrenSubtotalMinor,
    totalMinor,
    totalUsdCents: convertMinor(totalMinor, currency, "USD", rates),
    tier: { minPax: tier.minPax, maxPax: tier.maxPax, bookingType: tier.bookingType },
    priceModifierPercent: modifier,
    isConverted,
  };
}
