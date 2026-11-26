import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertMinor, formatMoney, quote, type PriceTierLike, type QuoteResult } from "../src/lib/pricing";
import type { ExchangeRates } from "../src/db/types";

const rates: ExchangeRates = { base: "USD", rates: { USD: 1, UZS: 11973.44, EUR: 0.86 }, updatedAt: "", source: "manual" };
const tiers: PriceTierLike[] = [
  { bookingType: "private", minPax: 1, maxPax: 1, priceUsd: 189000, priceUzs: null, priceEur: 175000 },
  { bookingType: "private", minPax: 2, maxPax: 2, priceUsd: 119000, priceUzs: null, priceEur: 110000 },
  { bookingType: "group", minPax: 1, maxPax: 14, priceUsd: 96000, priceUzs: null, priceEur: 89000 },
];
const tour = { baseCurrency: "USD" as const, childPricePercent: 75, minGroup: 1, maxGroup: 14 };

function priced(r: QuoteResult) {
  if (!r.ok) throw new Error(`expected a price, got ${r.reason}`);
  return r;
}

describe("pricing engine", () => {
  it("uses the agency's own price when one is set for the currency", () => {
    const r = priced(quote({ tour, tiers, bookingType: "private", adults: 2, children: 0, currency: "EUR", rates }));
    assert.equal(r.perAdultMinor, 110000);
    assert.equal(r.isConverted, false);
  });

  it("converts from the base currency and rounds UZS to 1,000 so'm", () => {
    const r = priced(quote({ tour, tiers, bookingType: "private", adults: 2, children: 0, currency: "UZS", rates }));
    assert.equal(r.isConverted, true);
    assert.equal(r.perAdultMinor % 1000, 0);
    assert.equal(r.perAdultMinor, 14248000);
  });

  it("charges children the child percentage and applies the departure modifier", () => {
    const r = priced(quote({
      tour, tiers, bookingType: "group", adults: 2, children: 1, currency: "USD", rates,
      departure: { status: "open", seatsTotal: 14, seatsBooked: 0, priceModifierPercent: 10 },
    }));
    assert.equal(r.perAdultMinor, 105600);
    assert.equal(r.perChildMinor, 79200);
    assert.equal(r.totalMinor, 105600 * 2 + 79200);
  });

  it("rejects impossible requests with a clear reason", () => {
    const base = { tour, tiers, currency: "USD" as const, rates };
    assert.deepEqual(quote({ ...base, bookingType: "private", adults: 3, children: 0 }), { ok: false, reason: "no_tier" });
    assert.deepEqual(quote({ ...base, bookingType: "group", adults: 15, children: 0 }), { ok: false, reason: "group_too_large" });
    assert.deepEqual(quote({ ...base, bookingType: "group", adults: 0, children: 2 }), { ok: false, reason: "invalid_party" });
    assert.deepEqual(
      quote({ ...base, bookingType: "group", adults: 4, children: 0, departure: { status: "open", seatsTotal: 14, seatsBooked: 12, priceModifierPercent: 0 } }),
      { ok: false, reason: "insufficient_seats" },
    );
    assert.deepEqual(
      quote({ ...base, bookingType: "group", adults: 1, children: 0, departure: { status: "sold_out", seatsTotal: 14, seatsBooked: 14, priceModifierPercent: 0 } }),
      { ok: false, reason: "departure_unavailable" },
    );
  });

  it("converts and formats money in all three languages", () => {
    assert.equal(convertMinor(10000, "USD", "UZS", rates), 1197344); // $100 → 1,197,344 so'm
    assert.equal(convertMinor(8600, "EUR", "USD", rates), 10000); // €86 → $100
    assert.equal(formatMoney(154400, "USD", "en"), "$1,544");
    assert.match(formatMoney(3808000, "UZS", "uz"), /^3\s808\s000 so'm$/);
    assert.match(formatMoney(3808000, "UZS", "ru"), /^3\s808\s000 сум$/);
  });
});
