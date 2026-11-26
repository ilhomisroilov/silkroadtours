import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoArrange, daysFromDates, estimateBudget, tripDayCount } from "../src/lib/trip-helpers.ts";
import type { TripState } from "../src/lib/trip-store.ts";

const trip = (over: Partial<TripState> = {}): TripState => ({ version: 1, title: "", destinations: [], adults: 2, children: 0, items: [], ...over });

describe("trip helpers", () => {
  it("counts days from dates, inclusive", () => {
    assert.equal(daysFromDates("2027-05-01", "2027-05-05"), 5);
    assert.equal(daysFromDates("2027-05-05", "2027-05-01"), null);
    assert.equal(tripDayCount(trip({ startDate: "2027-05-01", endDate: "2027-05-03" })), 3);
    assert.equal(tripDayCount(trip()), 3);
  });

  it("prices hotels per room-night, per-person items per traveller, and adds everyday meals", () => {
    const b = estimateBudget(
      trip({
        startDate: "2027-05-01",
        endDate: "2027-05-04",
        adults: 3,
        items: [
          { id: "hotel:a", kind: "hotel", title: "A", priceUsd: 50, priceUnit: "night", day: 1 },
          { id: "train:x", kind: "train", title: "X", priceUsd: 20, priceUnit: "person", day: 1 },
          { id: "transfer:y", kind: "transfer", title: "Y", priceUsd: 30, priceUnit: "group", day: 2 },
        ],
      }),
    );
    // 4 days → 3 nights, 3 travellers → 2 rooms; 50×3×2 + 20×3 + 30 + meals 20×4×3
    assert.equal(b.byCategory.stay, 300);
    assert.equal(b.byCategory.transport, 90);
    assert.equal(b.byCategory.food, 240);
    assert.equal(b.totalUsd, 630);
    assert.equal(b.byDay.reduce((a, x) => a + x, 0), 630);
    assert.equal(estimateBudget(trip(), { includeMeals: false }).totalUsd, 0);
  });

  it("auto-arranges by destination order, hotels and arrivals first, within the trip's days", () => {
    const t = trip({
      startDate: "2027-05-01",
      endDate: "2027-05-04",
      destinations: ["samarkand", "bukhara"],
      items: [
        { id: "attraction:b1", kind: "attraction", title: "B1", destinationSlug: "bukhara", lat: 39.77, lng: 64.41 },
        { id: "attraction:s1", kind: "attraction", title: "S1", destinationSlug: "samarkand", lat: 39.65, lng: 66.97 },
        { id: "hotel:s", kind: "hotel", title: "HS", destinationSlug: "samarkand", lat: 39.65, lng: 66.96 },
        { id: "transport:t", kind: "train", title: "T", destinationSlug: "bukhara", lat: 39.7, lng: 66.9 },
        { id: "attraction:s2", kind: "attraction", title: "S2", destinationSlug: "samarkand", lat: 39.66, lng: 66.98 },
      ],
    });
    const out = autoArrange(t);
    const day = (id: string) => out.find((i) => i.id === id)!.day!;
    assert.equal(out.length, 5);
    assert.ok(out.every((i) => i.day! >= 1 && i.day! <= 4));
    assert.equal(day("hotel:s"), 1);
    assert.ok(day("attraction:s1") < day("attraction:b1"));
    assert.equal(day("transport:t"), day("attraction:b1"));
  });
});
