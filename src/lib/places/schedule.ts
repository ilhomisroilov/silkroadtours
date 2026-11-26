// Flights & trains search: typical departures built from the transport catalogue.
// Pure and deterministic: the same route, direction and date always give the same times and fares,
// on the server and in the browser, so nothing changes between renders.

export const SEARCH_MODES = ["train", "flight", "bus", "shared_taxi", "car"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** Cities a traveller can search between (lower-case keys; labels live in transportSearch.cities.*). */
export const CITY_KEYS = ["tashkent", "samarkand", "bukhara", "khiva", "urgench", "nukus", "termez", "kokand", "shakhrisabz"] as const;
export type CityKey = (typeof CITY_KEYS)[number];

/** Airport and station codes, and destination slugs, that map onto a city key (for deep links). */
const CITY_ALIASES: Record<string, CityKey> = {
  tas: "tashkent",
  skd: "samarkand",
  bhk: "bukhara",
  ugc: "urgench",
  ncu: "nukus",
  tmj: "termez",
  "karakalpakstan-aral": "nukus",
  "fergana-valley": "kokand",
  fergana: "kokand",
  margilan: "kokand",
  toshkent: "tashkent",
  samarqand: "samarkand",
  buxoro: "bukhara",
  xiva: "khiva",
  urganch: "urgench",
  termiz: "termez",
  qoqon: "kokand",
  shahrisabz: "shakhrisabz",
  "ташкент": "tashkent",
  "самарканд": "samarkand",
  "бухара": "bukhara",
  "хива": "khiva",
  "ургенч": "urgench",
  "нукус": "nukus",
  "термез": "termez",
  "коканд": "kokand",
  "шахрисабз": "shakhrisabz",
};

/** A searched city also matches routes ending at its gateway (Khiva is reached through Urgench airport). */
const GATEWAY: Partial<Record<CityKey, CityKey>> = { urgench: "khiva" };

/** Destination page for each city (used for "Add to trip"). */
export const CITY_DESTINATION: Record<CityKey, string> = {
  tashkent: "tashkent",
  samarkand: "samarkand",
  bukhara: "bukhara",
  khiva: "khiva",
  urgench: "khiva",
  nukus: "nukus",
  termez: "termez",
  kokand: "kokand",
  shakhrisabz: "shakhrisabz",
};

export function normalizeCity(input: string | null | undefined): CityKey | undefined {
  if (!input) return undefined;
  const v = input.trim().toLowerCase().replace(/[ʻʼ'`’]/g, "").replace(/\s+/g, "-");
  if ((CITY_KEYS as readonly string[]).includes(v)) return v as CityKey;
  return CITY_ALIASES[v];
}

export const cityKeyOf = (name: string): CityKey | undefined => normalizeCity(name);

/** What the server passes to the search: one catalogue route, already localized. */
export interface RouteData {
  slug: string;
  mode: SearchMode;
  from: CityKey;
  to: CityKey;
  durationMin: number;
  name: string;
  /** Localized service label, e.g. "Afrosiyob high-speed train". */
  operator: string;
  note: string;
  image: string | null;
  /** Fare classes in catalogue order (cheapest first); priceFromUsd per person, or per vehicle for cars. */
  classes: { key: string; name: string; priceFromUsd: number }[];
}

export interface Departure {
  id: string;
  slug: string;
  mode: SearchMode;
  from: CityKey;
  to: CityKey;
  /** "07:28" */
  dep: string;
  arr: string;
  depMin: number;
  /** Days added to the arrival (overnight trains). */
  arrDays: number;
  durationMin: number;
  fares: { key: string; name: string; priceUsd: number }[];
}

/** FNV-1a 32-bit hash: stable across Node and browsers. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const hhmm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** 0 = Sunday … 6 = Saturday for an ISO date. */
export const weekdayOf = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();

const PEAK_MONTHS = new Set([4, 5, 9, 10]);

interface Profile {
  count: number;
  start: number;
  end: number;
  step: number;
}

function profile(r: RouteData, dir: string, weekday: number): Profile {
  const h = hash(`${r.slug}|${dir}`);
  const busyDay = weekday === 5 || weekday === 0; // Friday and Sunday
  switch (r.mode) {
    case "train":
      if (r.durationMin >= 600) return { count: 1, start: 17 * 60 + 10, end: 21 * 60, step: 1 };
      return { count: 3 + (h % 3) + (busyDay ? 1 : 0), start: 6 * 60, end: 19 * 60 + 30, step: 1 };
    case "flight":
      return { count: 1 + (h % 2) + (busyDay ? 1 : 0), start: 6 * 60 + 40, end: 20 * 60 + 30, step: 5 };
    case "bus":
      return { count: 4, start: 6 * 60 + 30, end: 17 * 60, step: 15 };
    case "shared_taxi":
      return { count: 5, start: 5 * 60 + 30, end: 16 * 60, step: 30 };
    case "car":
      return { count: 3, start: 8 * 60, end: 15 * 60, step: 60 };
  }
}

/** Typical departures of one route in one direction on a date. */
export function departuresFor(r: RouteData, reversed: boolean, date: string): Departure[] {
  const dir = reversed ? "r" : "f";
  const weekday = weekdayOf(date);
  const month = Number(date.slice(5, 7));
  const p = profile(r, dir, weekday);
  const span = p.end - p.start;
  const out: Departure[] = [];
  for (let i = 0; i < p.count; i++) {
    const h = hash(`${r.slug}|${dir}|${i}`);
    const base = p.count === 1 ? p.start + (h % Math.max(1, span)) : p.start + Math.round((span * i) / (p.count - 1));
    const jitter = p.count === 1 || r.mode === "car" ? 0 : ((h >>> 4) % 41) - 20;
    let depMin = base + jitter;
    depMin = Math.round(depMin / p.step) * p.step;
    depMin = Math.min(Math.max(depMin, 4 * 60), 23 * 60 + 30);
    const durVar = r.mode === "train" && r.durationMin < 600 ? (((h >>> 9) % 3) - 1) * 6 : r.mode === "bus" || r.mode === "shared_taxi" ? ((h >>> 9) % 3) * 10 : 0;
    const durationMin = r.durationMin + durVar;
    const arrAbs = depMin + durationMin;
    const peakSlot = (depMin >= 7 * 60 && depMin <= 9 * 60 + 30) || (depMin >= 17 * 60 && depMin <= 19 * 60 + 30);
    const factor =
      1 +
      (weekday === 5 || weekday === 0 ? 0.08 : 0) +
      (peakSlot && r.mode !== "car" ? 0.06 : 0) +
      (PEAK_MONTHS.has(month) && r.mode !== "car" ? 0.1 : 0) +
      ((h >>> 13) % 7) / 100;
    out.push({
      id: `${r.slug}${reversed ? "-r" : ""}-${date}-${hhmm(depMin).replace(":", "")}`,
      slug: r.slug,
      mode: r.mode,
      from: reversed ? r.to : r.from,
      to: reversed ? r.from : r.to,
      dep: hhmm(depMin),
      arr: hhmm(arrAbs),
      depMin,
      arrDays: Math.floor(arrAbs / 1440),
      durationMin,
      fares: r.classes.map((c) => ({ key: c.key, name: c.name, priceUsd: Math.ceil(c.priceFromUsd * (r.mode === "car" ? 1 : factor)) })),
    });
  }
  // Two departures rounded onto the same minute would look like a duplicate.
  return out.filter((d, i, all) => all.findIndex((x) => x.dep === d.dep) === i).sort((a, b) => a.depMin - b.depMin);
}

const matches = (routeCity: CityKey, wanted: CityKey) => routeCity === wanted || GATEWAY[routeCity] === wanted;

/** All typical departures between two cities on a date, both directions of every route. */
export function searchDepartures(routes: RouteData[], from: CityKey, to: CityKey, date: string): Departure[] {
  if (from === to) return [];
  const out: Departure[] = [];
  for (const r of routes) {
    if (matches(r.from, from) && matches(r.to, to)) out.push(...departuresFor(r, false, date));
    else if (matches(r.to, from) && matches(r.from, to)) out.push(...departuresFor(r, true, date));
  }
  return out.sort((a, b) => a.depMin - b.depMin);
}

/** Cities that have at least one route, for the origin / destination lists. */
export function connectedCities(routes: RouteData[]): CityKey[] {
  const s = new Set<CityKey>();
  for (const r of routes) {
    s.add(r.from);
    s.add(r.to);
    const g = GATEWAY[r.to];
    if (g) s.add(g);
    const gf = GATEWAY[r.from];
    if (gf) s.add(gf);
  }
  return CITY_KEYS.filter((c) => s.has(c));
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export function timeOfDay(depMin: number): TimeOfDay {
  if (depMin >= 5 * 60 && depMin < 12 * 60) return "morning";
  if (depMin >= 12 * 60 && depMin < 17 * 60) return "afternoon";
  if (depMin >= 17 * 60 && depMin < 21 * 60) return "evening";
  return "night";
}

/** Fare for a requested class: "business" takes the top class, anything else the cheapest. */
export function pickFare(d: Departure, cls: string): Departure["fares"][number] | undefined {
  if (d.fares.length === 0) return undefined;
  if (cls === "business") return d.fares[d.fares.length - 1];
  return d.fares[0];
}

/** Cars are priced per vehicle; everything else per person. */
export const perVehicle = (mode: SearchMode) => mode === "car";

/** Today's date in Uzbekistan (UTC+5) plus n days, as YYYY-MM-DD. */
export function tashkentDate(addDays = 0, now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000 + addDays * 86400_000).toISOString().slice(0, 10);
}
