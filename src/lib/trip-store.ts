"use client";

/**
 * The visitor's trip in progress, shared by the Trip Constructor, the travel map, hotel/restaurant pages,
 * the flight & train search and the AI guide. Stored in localStorage only (no account needed);
 * saving or sharing a trip sends a snapshot to /api/trips.
 */
export type TripItemKind =
  | "hotel"
  | "restaurant"
  | "transport"
  | "flight"
  | "train"
  | "transfer"
  | "attraction"
  | "experience"
  | "tour"
  | "activity";

export interface TripItem {
  /** Unique within the trip, e.g. "hotel:bukhara-boutique-courtyard-lyabi-hauz" or "train:TAS-SKD-2026-05-02-0728". */
  id: string;
  kind: TripItemKind;
  title: string;
  /** Catalogue slug when the item comes from our data (places, tours, experiences). */
  refSlug?: string;
  destinationSlug?: string;
  /** Indicative price in whole USD and what it is per. */
  priceUsd?: number;
  priceUnit?: "night" | "person" | "trip" | "meal" | "group";
  lat?: number;
  lng?: number;
  /** Day number in the itinerary (1-based); undefined = not scheduled yet. */
  day?: number;
  /** Short extra line, e.g. "07:28 → 09:38 · Economy". */
  meta?: string;
  image?: string;
}

export interface TripState {
  version: 1;
  title: string;
  destinations: string[];
  startDate?: string;
  endDate?: string;
  adults: number;
  children: number;
  items: TripItem[];
  notes?: string;
  /** Id of the last saved/shared snapshot. */
  savedId?: string;
}

export const TRIP_STORAGE_KEY = "nt.trip.v1";
export const TRIP_CHANGE_EVENT = "nt-trip-change";

export const emptyTrip = (): TripState => ({ version: 1, title: "", destinations: [], adults: 2, children: 0, items: [] });

export function loadTrip(): TripState {
  try {
    const raw = window.localStorage.getItem(TRIP_STORAGE_KEY);
    if (!raw) return emptyTrip();
    const parsed = JSON.parse(raw) as TripState;
    return parsed && parsed.version === 1 && Array.isArray(parsed.items) ? parsed : emptyTrip();
  } catch {
    return emptyTrip();
  }
}

export function saveTrip(state: TripState): void {
  try {
    window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or storage full: the trip still lives in memory for this page */
  }
  window.dispatchEvent(new CustomEvent(TRIP_CHANGE_EVENT, { detail: state }));
}

export function addTripItem(item: TripItem): TripState {
  const state = loadTrip();
  if (!state.items.some((i) => i.id === item.id)) state.items.push(item);
  if (item.destinationSlug && !state.destinations.includes(item.destinationSlug)) state.destinations.push(item.destinationSlug);
  saveTrip(state);
  return state;
}

export function removeTripItem(id: string): TripState {
  const state = loadTrip();
  state.items = state.items.filter((i) => i.id !== id);
  saveTrip(state);
  return state;
}

export function hasTripItem(id: string): boolean {
  return loadTrip().items.some((i) => i.id === id);
}

/** Subscribe to changes from this tab and other tabs. Returns an unsubscribe function. */
export function onTripChange(cb: (state: TripState) => void): () => void {
  const local = (e: Event) => cb((e as CustomEvent<TripState>).detail ?? loadTrip());
  const storage = (e: StorageEvent) => e.key === TRIP_STORAGE_KEY && cb(loadTrip());
  window.addEventListener(TRIP_CHANGE_EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(TRIP_CHANGE_EVENT, local);
    window.removeEventListener("storage", storage);
  };
}
