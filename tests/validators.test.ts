import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { pricingReplaceSchema, tourUpsertSchema } from "../src/validators/admin";
import { bookingInputSchema } from "../src/validators/booking";
import { todayInTashkent } from "../src/validators/common";
import { reviewSubmitSchema } from "../src/validators/public";
import { serviceRequestSchema } from "../src/validators/service-request";

const future = (days: number) => todayInTashkent(new Date(Date.now() + days * 86400_000));

const validBooking = {
  tourSlug: "classic-silk-road-8-days",
  bookingType: "group",
  fullName: "Anna Schmidt",
  email: "Anna@Example.com",
  phone: "+49 151 2345 6789",
  contactChannel: "whatsapp",
  locale: "en",
  turnstileToken: "token",
  preferredDate: future(30),
  adults: 2,
  children: 0,
  currency: "EUR",
};

const issues = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe("booking form validation", () => {
  it("accepts a valid booking and normalises email and phone", () => {
    const r = bookingInputSchema.safeParse(validBooking);
    assert.ok(r.success);
    assert.equal(r.data.email, "anna@example.com");
    assert.equal(r.data.phone, "+4915123456789");
  });

  it("rejects bad phone, past date, no adults and missing tour", () => {
    assert.deepEqual(issues(bookingInputSchema.safeParse({ ...validBooking, phone: "call me" })), ["invalid_phone"]);
    assert.deepEqual(issues(bookingInputSchema.safeParse({ ...validBooking, preferredDate: "2020-01-01" })), ["date_in_past"]);
    assert.deepEqual(issues(bookingInputSchema.safeParse({ ...validBooking, adults: 0 })), ["min_one_adult"]);
    const { tourSlug: _t, ...noTour } = validBooking;
    assert.deepEqual(issues(bookingInputSchema.safeParse(noTour)), ["tour_or_destination_required"]);
  });
});

describe("service request validation", () => {
  const contact = {
    fullName: "Li Wei", email: "li@example.cn", phone: "+86 138 0000 0000",
    contactChannel: "telegram", locale: "en", turnstileToken: "t",
  };

  it("validates each request type by its own fields", () => {
    const transfer = serviceRequestSchema.safeParse({
      ...contact, type: "airport_transfer", airport: "TAS", direction: "arrival", date: future(10),
      time: "14:30", passengers: 3, luggage: 4, address: "Hotel Uzbekistan, Tashkent", vehicleClass: "minivan",
    });
    assert.ok(transfer.success, JSON.stringify(transfer.error?.issues));
    const badTime = serviceRequestSchema.safeParse({
      ...contact, type: "airport_transfer", airport: "TAS", direction: "arrival", date: future(10),
      time: "25:99", passengers: 3, luggage: 4, address: "Hotel", vehicleClass: "minivan",
    });
    assert.deepEqual(issues(badTime), ["invalid_time"]);
  });

  it("rejects a hotel stay that ends before it starts", () => {
    const r = serviceRequestSchema.safeParse({
      ...contact, type: "accommodation", kind: "yurt_camp", destinationSlug: "karakalpakstan-aral",
      checkIn: future(20), checkOut: future(19), rooms: 1, guests: 2, level: "comfort",
    });
    assert.deepEqual(issues(r), ["checkout_before_checkin"]);
  });
});

describe("review validation", () => {
  const review = {
    reference: "UZ-2026-12345", email: "a@b.com", rating: 5,
    body: "Wonderful trip, our guide was excellent.", language: "en", turnstileToken: "t",
  };
  it("accepts 1–5 stars only", () => {
    assert.ok(reviewSubmitSchema.safeParse(review).success);
    assert.deepEqual(issues(reviewSubmitSchema.safeParse({ ...review, rating: 6 })), ["rating_range"]);
    assert.deepEqual(issues(reviewSubmitSchema.safeParse({ ...review, rating: 0 })), ["rating_range"]);
  });
});

describe("admin validation", () => {
  it("requires the base-currency price and non-overlapping tiers", () => {
    const schema = pricingReplaceSchema("UZS");
    const okTiers = [
      { bookingType: "group", minPax: 1, maxPax: 10, priceUsd: null, priceUzs: 1_190_000, priceEur: null },
      { bookingType: "group", minPax: 11, maxPax: 40, priceUsd: null, priceUzs: 990_000, priceEur: null },
    ];
    assert.ok(schema.safeParse(okTiers).success);
    assert.ok(issues(schema.safeParse([{ ...okTiers[0], priceUzs: null, priceUsd: 9900 }])).includes("base_price_required"));
    assert.ok(issues(schema.safeParse([okTiers[0], { ...okTiers[1], minPax: 10 }])).includes("tier_overlap"));
  });

  it("accepts site-relative image paths and rejects other URLs", () => {
    const shape = tourUpsertSchema.safeParse({ heroImage: "/images/tours/x.jpg" });
    const heroIssue = (r: typeof shape) => (r.success ? [] : r.error.issues.filter((i) => i.path[0] === "heroImage"));
    assert.equal(heroIssue(shape).length, 0);
    assert.equal(heroIssue(tourUpsertSchema.safeParse({ heroImage: "javascript:alert(1)" })).length, 1);
    assert.equal(heroIssue(tourUpsertSchema.safeParse({ heroImage: "http://insecure.example/x.jpg" })).length, 1);
  });
});

describe("translations", () => {
  it("has the same error messages in English, Uzbek and Russian", () => {
    const load = (l: string) => Object.keys(JSON.parse(readFileSync(`messages/${l}.json`, "utf8")).errors).sort();
    const en = load("en");
    assert.ok(en.length > 50);
    assert.deepEqual(load("uz"), en);
    assert.deepEqual(load("ru"), en);
  });
});
