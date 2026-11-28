#!/usr/bin/env node
/**
 * End-to-end smoke test against a running copy of the app.
 *
 *   npm run dev            (terminal 1)
 *   npm run test:smoke     (terminal 2)
 *
 * BASE_URL defaults to http://localhost:3000.
 * Uses the local database only. Creates one booking, one service request and one review per run.
 * Reads ADMIN_SECRET from .dev.vars to create a local test admin; its password is kept in
 * .smoke-admin.json (git-ignored) so later runs can sign in.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"; // accepted by Cloudflare's test secret keys
// A fresh fake client IP per run, so the 5-per-10-minutes spam limit doesn't block repeated test runs.
// (In production Cloudflare sets this header itself; visitors cannot change it.)
const TEST_IP = `10.${rand(255)}.${rand(255)}.${rand(255)}`;
const results = [];
let cookie = "";

function rand(n) {
  return Math.floor(Math.random() * n);
}

function devVar(name) {
  if (!existsSync(".dev.vars")) return "";
  const line = readFileSync(".dev.vars", "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

async function api(method, path, body, { auth = false, origin = true, headers = {} } = {}) {
  const h = { "cf-connecting-ip": TEST_IP, ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (origin) h.origin = BASE;
  if (auth && cookie) h.cookie = cookie;
  const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, res };
}

async function check(name, fn) {
  try {
    const note = await fn();
    if (note && typeof note === "object" && note.skip) {
      results.push({ name, state: "SKIP", note: note.skip });
      console.log(`  ⏭  ${name} — ${note.skip}`);
    } else {
      results.push({ name, state: "PASS" });
      console.log(`  ✅ ${name}${typeof note === "string" ? ` — ${note}` : ""}`);
    }
  } catch (err) {
    results.push({ name, state: "FAIL", note: err.message });
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
}
function expectStatus(r, status, code) {
  const got = `${r.status}${r.json?.error?.code ? ` ${r.json.error.code}` : ""}`;
  expect(r.status === status, `expected HTTP ${status}${code ? ` ${code}` : ""}, got ${got}${r.json?.error?.fields ? ` ${JSON.stringify(r.json.error.fields)}` : ""}${r.json?.error?.message ? ` (${r.json.error.message})` : ""}`);
  if (code) expect(r.json?.error?.code === code, `expected error code ${code}, got ${got}`);
}
const futureDate = (days) => new Date(Date.now() + days * 86400_000 + 5 * 3600_000).toISOString().slice(0, 10);

// ── Run ────────────────────────────────────────────────────────────────────
console.log(`\nSmoke test against ${BASE}\n`);

let health;
try {
  health = await api("GET", "/api/health");
} catch (err) {
  console.log(`❌ Cannot reach ${BASE}. Is the app running? (npm run dev)\n   ${err.message}\n`);
  process.exit(1);
}

console.log("1. Database and catalogue");
await check("health check reads the database", () => {
  expectStatus(health, 200);
  const db = health.json.data.database;
  expect(db.destinations === 19, `expected 19 destinations, got ${db.destinations} — run: npm run db:reset:local`);
  expect(db.tours === 27, `expected 27 tours, got ${db.tours} — run: npm run db:reset:local`);
  return `${db.destinations} destinations, ${db.tours} tours`;
});
await check("destinations list", async () => {
  const r = await api("GET", "/api/destinations");
  expectStatus(r, 200);
  expect(r.json.data.length === 19, "expected 19 destinations");
  expect(r.json.data.every((d) => d.tourCount >= 2), "every destination should have at least 2 tours");
});
await check("tour filters: audience, currency, month, destination", async () => {
  const all = await api("GET", "/api/tours?pageSize=48");
  expect(all.json.data.total === 27, `expected 27 tours, got ${all.json.data.total}`);
  const domestic = await api("GET", "/api/tours?audience=domestic&currency=UZS&pageSize=48");
  expect(domestic.json.data.total === 10, `expected 10 domestic tours, got ${domestic.json.data.total}`);
  expect(domestic.json.data.items.every((t) => t.fromPrice?.currency === "UZS"), "prices should be in UZS");
  const july = await api("GET", "/api/tours?month=7&pageSize=48");
  const slugs = july.json.data.items.map((t) => t.slug);
  expect(slugs.includes("zomin-weekend-mountain-getaway") && !slugs.includes("aral-sea-expedition"), "July filter is wrong");
  const zaamin = await api("GET", "/api/tours?destination=zaamin");
  expect(zaamin.json.data.total >= 2, "Zaamin should have tours");
});
await check("search works in Uzbek and Russian", async () => {
  const ru = await api("GET", `/api/tours?q=${encodeURIComponent("самарканд")}`);
  const uz = await api("GET", `/api/tours?q=${encodeURIComponent("Samarqand")}`);
  expect(ru.json.data.total >= 1 && uz.json.data.total >= 1, "search returned nothing");
});
await check("tour detail with itinerary and EUR price table", async () => {
  const r = await api("GET", "/api/tours/classic-silk-road-8-days?currency=EUR");
  expectStatus(r, 200);
  expect(r.json.data.tour.itinerary.length === 8, "expected 8 itinerary days");
  expect(r.json.data.pricing.every((p) => p.currency === "EUR"), "price table should be EUR");
  expect(r.json.data.tour.departures.length > 0, "expected upcoming departures");
});
await check("unknown tour returns 404", async () => expectStatus(await api("GET", "/api/tours/no-such-tour"), 404, "tour_not_found"));

console.log("\n2. Prices in three currencies");
for (const [cur, expected] of [["USD", "$1,190"], ["EUR", "€1,100"], ["UZS", null]]) {
  await check(`quote: Classic Silk Road, private, 2 adults, ${cur}`, async () => {
    const r = await api("GET", `/api/tours/classic-silk-road-8-days/quote?adults=2&type=private&currency=${cur}`);
    expectStatus(r, 200);
    const per = r.json.data.perAdultMinor;
    if (cur === "USD") expect(per === 119000, `expected 119000 cents, got ${per}`);
    if (cur === "EUR") expect(per === 110000, `expected 110000 cents, got ${per}`);
    if (cur === "UZS") expect(per > 10_000_000 && per % 1000 === 0, `unexpected UZS price ${per}`);
    return expected ?? `${per.toLocaleString("en")} so'm per adult (converted)`;
  });
}
await check("quote refuses a group that is too large", async () =>
  expectStatus(await api("GET", "/api/tours/classic-silk-road-8-days/quote?adults=40&type=group"), 422, "quote_group_too_large"),
);

console.log("\n3. Booking flow");
const email = `smoke-${Date.now()}@example.com`;
let reference = "";
let departure = null;
await check("invalid booking is rejected with field errors", async () => {
  const r = await api("POST", "/api/bookings", { fullName: "A", email: "nope", adults: 0 });
  expectStatus(r, 400, "validation_failed");
  expect(r.json.error.fields.email && r.json.error.fields.fullName, "expected email and fullName errors");
});
await check("valid booking is saved as PENDING with a reference", async () => {
  const detail = await api("GET", "/api/tours/classic-silk-road-8-days");
  departure = detail.json.data.tour.departures.find((d) => d.seatsTotal - d.seatsBooked >= 2);
  expect(departure, "no departure with 2 free seats");
  const r = await api("POST", "/api/bookings", {
    tourSlug: "classic-silk-road-8-days",
    departureId: departure.id,
    bookingType: "group",
    fullName: "Smoke Test Traveller",
    email,
    phone: "+998 90 123 45 67",
    contactChannel: "telegram",
    messengerHandle: "@smoke_test",
    country: "Germany",
    preferredDate: departure.startDate,
    adults: 2,
    children: 0,
    currency: "EUR",
    locale: "en",
    specialRequests: "Automated smoke test — please ignore.",
    turnstileToken: TURNSTILE_TEST_TOKEN,
  });
  if (r.json?.error?.code === "captcha_failed") {
    throw new Error("captcha_failed — .dev.vars must use the Turnstile TEST secret 1x0000000000000000000000000000000AA for local testing");
  }
  expectStatus(r, 201);
  reference = r.json.data.reference;
  expect(/^UZ-\d{4}-\d{5}$/.test(reference), `bad reference ${reference}`);
  return reference;
});
await check("confirmation lookup shows no personal data", async () => {
  const r = await api("GET", `/api/bookings/${reference}`);
  expectStatus(r, 200);
  expect(r.json.data.status === "pending", "status should be pending");
  const text = JSON.stringify(r.json);
  expect(!text.includes(email) && !text.includes("123 45 67"), "personal data leaked");
});
await check("airport transfer request", async () => {
  const r = await api("POST", "/api/service-requests", {
    type: "airport_transfer", airport: "TAS", direction: "arrival", flightNumber: "HY 602", date: futureDate(20), time: "14:30",
    passengers: 2, luggage: 3, address: "Hotel in central Tashkent", vehicleClass: "sedan",
    fullName: "Smoke Test Traveller", email, phone: "+998901234567", contactChannel: "whatsapp", locale: "ru",
    turnstileToken: TURNSTILE_TEST_TOKEN,
  });
  expectStatus(r, 201);
  expect(/^SR-\d{4}-\d{5}$/.test(r.json.data.reference), "bad reference");
  return r.json.data.reference;
});
await check("FAQ, rates and contact endpoints", async () => {
  const [faq, rates, contact] = await Promise.all([api("GET", "/api/faq"), api("GET", "/api/rates"), api("GET", "/api/contact")]);
  expect(faq.json.data.length === 35, "expected 35 FAQ items");
  expect(rates.json.data.rates.UZS > 1000, "bad UZS rate");
  expect(contact.json.data.agencyName, "missing agency name");
});

console.log("\n4. Admin security and management");
await check("admin API refuses requests without a session", async () =>
  expectStatus(await api("GET", "/api/admin/bookings"), 401, "unauthorized"),
);
await check("login refuses requests from another website (CSRF check)", async () =>
  expectStatus(await api("POST", "/api/admin/auth/login", { email: "x@y.z", password: "x" }, { origin: false }), 403, "missing_origin"),
);

let creds = existsSync(".smoke-admin.json") ? JSON.parse(readFileSync(".smoke-admin.json", "utf8")) : null;
await check("first admin account (bootstrap)", async () => {
  const secret = devVar("ADMIN_SECRET");
  if (!secret) return { skip: "ADMIN_SECRET is not set in .dev.vars" };
  const wrong = await api("POST", "/api/admin/auth/bootstrap", { email: "a@b.c", name: "x", password: "x".repeat(12) }, { headers: { "x-admin-secret": "wrong-secret-wrong" } });
  expect([403, 503].includes(wrong.status), `wrong secret should be refused, got ${wrong.status}`);
  const candidate = { email: "smoke-admin@example.com", name: "Smoke Test Admin", password: randomBytes(18).toString("base64url") };
  const r = await api("POST", "/api/admin/auth/bootstrap", candidate, { headers: { "x-admin-secret": secret } });
  if (r.status === 201) {
    creds = { email: candidate.email, password: candidate.password };
    writeFileSync(".smoke-admin.json", JSON.stringify(creds, null, 2));
    return "created local test admin (saved in .smoke-admin.json)";
  }
  expectStatus(r, 409, "already_bootstrapped");
  if (!creds) return { skip: "an admin already exists — run `npm run db:reset:local` to test admin features from scratch" };
  return "already set up — reusing .smoke-admin.json";
});

if (creds) {
  await check("wrong password is refused", async () =>
    expectStatus(await api("POST", "/api/admin/auth/login", { email: creds.email, password: "definitely-wrong-password" }), 401, "invalid_credentials"),
  );
  await check("login sets a secure session cookie", async () => {
    const r = await api("POST", "/api/admin/auth/login", creds);
    expectStatus(r, 200);
    const set = r.res.headers.getSetCookie().find((c) => c.startsWith("st_admin="));
    expect(set && /HttpOnly/i.test(set), "missing HttpOnly session cookie");
    cookie = set.split(";")[0];
  });

  let bookingId = 0;
  await check("booking appears in the admin list", async () => {
    const r = await api("GET", `/api/admin/bookings?q=${reference}`, undefined, { auth: true });
    expectStatus(r, 200);
    bookingId = r.json.data.items[0]?.id;
    expect(bookingId, "booking not found in admin list");
  });
  await check("confirming the booking reserves 2 seats", async () => {
    const r = await api("PATCH", `/api/admin/bookings/${bookingId}`, { status: "confirmed", note: "smoke test" }, { auth: true });
    expectStatus(r, 200);
    expect(r.json.data.departure.seatsBooked === departure.seatsBooked + 2, `seats went ${departure.seatsBooked} → ${r.json.data.departure.seatsBooked}`);
    expect(r.json.data.notes.some((n) => n.kind === "status_change"), "status change not recorded in notes");
  });
  await check("invalid status change is refused", async () => {
    await api("PATCH", `/api/admin/bookings/${bookingId}`, { status: "completed" }, { auth: true });
    expectStatus(await api("PATCH", `/api/admin/bookings/${bookingId}`, { status: "pending" }, { auth: true }), 422, "invalid_status_transition");
  });
  await check("guest can review a completed trip (1–5 stars only)", async () => {
    const base = { reference, email, body: "Automated smoke test review — the trip was well organised.", language: "en", turnstileToken: TURNSTILE_TEST_TOKEN };
    expectStatus(await api("POST", "/api/reviews", { ...base, rating: 6 }), 400, "validation_failed");
    expectStatus(await api("POST", "/api/reviews", { ...base, email: "someone-else@example.com", rating: 5 }), 404, "booking_not_found");
    expectStatus(await api("POST", "/api/reviews", { ...base, rating: 5 }), 201);
    expectStatus(await api("POST", "/api/reviews", { ...base, rating: 4 }), 409, "already_reviewed");
  });
  await check("publishing the review updates the tour rating", async () => {
    const list = await api("GET", "/api/admin/reviews?published=false", undefined, { auth: true });
    const review = list.json.data.items.find((x) => x.isVerified && x.tour?.slug === "classic-silk-road-8-days");
    expect(review, "verified review not found");
    expectStatus(await api("PATCH", `/api/admin/reviews/${review.id}`, { isPublished: true }, { auth: true }), 200);
    const tour = await api("GET", "/api/tours/classic-silk-road-8-days");
    expect(tour.json.data.tour.ratingCount >= 1 && tour.json.data.tour.ratingAvg > 0, "rating not updated");
  });
  await check("dashboard statistics", async () => {
    const r = await api("GET", "/api/admin/stats", undefined, { auth: true });
    expectStatus(r, 200);
    expect(r.json.data.totals.bookings >= 1 && r.json.data.daily.length === 30, "unexpected stats");
    return `${r.json.data.totals.bookings} bookings in the last 30 days`;
  });
  await check("tour CMS: duplicate, reject overlapping prices, delete", async () => {
    const list = await api("GET", "/api/admin/tours", undefined, { auth: true });
    const source = list.json.data.find((t) => t.slug === "zomin-weekend-mountain-getaway");
    const dup = await api("POST", `/api/admin/tours/${source.id}/duplicate`, undefined, { auth: true });
    expectStatus(dup, 201);
    const bad = await api("PUT", `/api/admin/tours/${dup.json.data.id}/pricing`, [
      { bookingType: "group", minPax: 1, maxPax: 10, priceUsd: null, priceUzs: 1000000, priceEur: null },
      { bookingType: "group", minPax: 5, maxPax: 20, priceUsd: null, priceUzs: 900000, priceEur: null },
    ], { auth: true });
    expectStatus(bad, 400, "validation_failed");
    expect(JSON.stringify(bad.json).includes("tier_overlap"), "expected tier_overlap");
    expectStatus(await api("DELETE", `/api/admin/tours/${dup.json.data.id}`, undefined, { auth: true }), 204);
  });

  console.log("\n5. Telegram");
  await check("booking alert delivered to the Telegram group", async () => {
    const h = await api("GET", "/api/health", undefined, { auth: true });
    if (!h.json.data.config?.telegramConfigured) return { skip: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set in .dev.vars (optional for local testing)" };
    await new Promise((r) => setTimeout(r, 3000));
    const b = await api("GET", `/api/admin/bookings/${bookingId}`, undefined, { auth: true });
    if (b.json.data.telegramNotifiedAt) return "message sent — check your Telegram group";
    const resend = await api("POST", `/api/admin/bookings/${bookingId}/notify`, undefined, { auth: true });
    expectStatus(resend, 200);
    return "delivered on resend — check your Telegram group";
  });

  await check("logout ends the session", async () => {
    expectStatus(await api("POST", "/api/admin/auth/logout", undefined, { auth: true }), 200);
    expectStatus(await api("GET", "/api/admin/auth/me", undefined, { auth: true }), 401, "unauthorized");
  });
}

// ── Summary ────────────────────────────────────────────────────────────────
const count = (s) => results.filter((r) => r.state === s).length;
console.log(`\nResult: ${count("PASS")} passed, ${count("FAIL")} failed, ${count("SKIP")} skipped\n`);
if (count("FAIL")) {
  console.log("Copy the ❌ lines above and send them to Claude.\n");
  process.exit(1);
}
