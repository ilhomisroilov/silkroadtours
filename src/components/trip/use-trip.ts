"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyTrip, loadTrip, onTripChange, saveTrip, type TripState } from "@/lib/trip-store";

/** The visitor's trip, kept in sync with every "Add to trip" button on the page and in other tabs. */
export function useTrip(): { trip: TripState; ready: boolean; update: (fn: (t: TripState) => TripState) => void; replace: (t: TripState) => void } {
  const [trip, setTrip] = useState<TripState>(emptyTrip);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setTrip(loadTrip());
    setReady(true);
    return onTripChange((s) => setTrip({ ...s, items: [...s.items] }));
  }, []);
  const update = useCallback((fn: (t: TripState) => TripState) => saveTrip(fn(loadTrip())), []);
  const replace = useCallback((t: TripState) => saveTrip(t), []);
  return { trip, ready, update, replace };
}
