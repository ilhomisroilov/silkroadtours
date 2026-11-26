import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { settings } from "../schema";
import type { ContactSettings, ExchangeRates, SettingKey, SettingsMap } from "../types";

/** Used only if the settings row is missing (the seed inserts real values). */
export const FALLBACK_RATES: ExchangeRates = {
  base: "USD",
  rates: { USD: 1, UZS: 11970, EUR: 0.86 },
  updatedAt: "2026-11-13T00:00:00.000Z",
  source: "manual",
};

export const FALLBACK_CONTACT: ContactSettings = {
  agencyName: "Silk Road Tours",
  phone: "",
  email: "",
  whatsapp: "",
  telegram: "",
  address: { en: "Jizzakh, Uzbekistan", uz: "Jizzax, Oʻzbekiston", ru: "Джизак, Узбекистан" },
  licenseNumber: "",
};

export async function getSetting<K extends SettingKey>(db: Db, key: K): Promise<SettingsMap[K] | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return (row?.value as SettingsMap[K] | undefined) ?? null;
}

export async function setSetting<K extends SettingKey>(db: Db, key: K, value: SettingsMap[K]): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getRates(db: Db): Promise<ExchangeRates> {
  return (await getSetting(db, "exchange_rates")) ?? FALLBACK_RATES;
}

export async function getContact(db: Db): Promise<ContactSettings> {
  return { ...FALLBACK_CONTACT, ...((await getSetting(db, "contact")) ?? {}) };
}
