// Official exchange rates from the Central Bank of Uzbekistan.
// Endpoint documented at https://cbu.uz/en/arkhiv-kursov-valyut/veb-masteram/
// Each item: { Ccy: "USD", Nominal: "1", Rate: "11973.44", Date: "13.11.2026", ... } (UZS per Nominal units).

import type { ExchangeRates } from "../db/types";

export const CBU_JSON_URL = "https://cbu.uz/en/arkhiv-kursov-valyut/json/";

interface CbuItem {
  Ccy?: unknown;
  Nominal?: unknown;
  Rate?: unknown;
  Date?: unknown;
}

function uzsPerUnit(items: CbuItem[], ccy: string): number {
  const item = items.find((i) => i.Ccy === ccy);
  if (!item) throw new Error(`CBU response has no ${ccy} rate`);
  const rate = Number(String(item.Rate).replace(",", "."));
  const nominal = Number(item.Nominal ?? 1) || 1;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`CBU ${ccy} rate is invalid`);
  return rate / nominal;
}

/** Converts a CBU response (UZS per foreign unit) into our USD-based ExchangeRates. */
export function parseCbuRates(json: unknown, now: Date = new Date()): ExchangeRates {
  if (!Array.isArray(json)) throw new Error("Unexpected CBU response shape");
  const items = json as CbuItem[];
  const usd = uzsPerUnit(items, "USD");
  const eur = uzsPerUnit(items, "EUR");
  return {
    base: "USD",
    rates: {
      USD: 1,
      UZS: Math.round(usd * 100) / 100,
      EUR: Math.round((usd / eur) * 10000) / 10000,
    },
    updatedAt: now.toISOString(),
    source: "cbu",
  };
}

export async function fetchCbuRates(fetchImpl: typeof fetch = fetch): Promise<ExchangeRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetchImpl(CBU_JSON_URL, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`CBU HTTP ${res.status}`);
    return parseCbuRates(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
