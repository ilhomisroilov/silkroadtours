import { existsSync, readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

/**
 * The 12 grant-demo journeys across the travel ecosystem. Runs in the desktop and the mobile
 * project (journey 12 = every journey on a 390px phone). Form submissions that other specs already
 * drive through the UI go through the public API here, with the same validation and anti-spam.
 */
const creds = existsSync(".smoke-admin.json") ? (JSON.parse(readFileSync(".smoke-admin.json", "utf8")) as { email: string; password: string }) : null;
const ip = () => ({ "x-real-ip": `10.88.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
const run = Date.now().toString(36).slice(-5);

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(creds!.email);
  await page.getByLabel(/password|parol/i).fill(creds!.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("1 · discover a destination", async ({ page }) => {
  await page.goto("/en/destinations");
  await page.locator('main a[href="/en/destinations/samarkand"]').first().click();
  await expect(page).toHaveURL(/\/en\/destinations\/samarkand$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Samarkand/i);
});

test("2 · open a virtual tour", async ({ page }) => {
  await page.goto("/en/virtual-tours");
  await page.locator('a[href^="/en/virtual-tours/"]').first().click();
  await expect(page).toHaveURL(/\/en\/virtual-tours\/[a-z-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // A 360° viewer or, where no real panorama exists, the photo tour.
  await expect(page.locator(".pnlm-container, [data-viewer], [data-photo-tour], figure img").first()).toBeVisible();
});

test("3 + 6 · build a trip and see the budget", async ({ page }) => {
  await page.goto("/en/hotels");
  await page.locator('a[href^="/en/hotels/"]').first().click();
  await expect(page).toHaveURL(/\/en\/hotels\/[a-z0-9-]+$/);
  const hotel = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  const add = page.getByTestId("add-to-trip").first();
  await add.click();
  await expect(add).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("nt.trip.v1") ?? "{}") as { items?: { kind: string }[] });
  expect(stored.items?.some((i) => i.kind === "hotel")).toBe(true);

  await page.goto("/en/trip-builder");
  await expect(page.getByText(hotel, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/\$\s?\d/).first()).toBeVisible();
});

test("4 · the AI creates an itinerary", async ({ request }) => {
  const res = await request.post("/api/ai/chat", { headers: ip(), data: { message: "Plan 5 days in Samarkand and Bukhara for history lovers", locale: "en" } });
  expect(res.ok()).toBe(true);
  const { data } = await res.json();
  expect(data.text.length).toBeGreaterThan(20);
  expect(data.cards.length).toBeGreaterThan(0);
  expect(data.text).not.toMatch(/booking is confirmed|I have booked/i);
});

test("5 · the AI guide recommends catalogue hotels you can add to the trip", async ({ page }) => {
  await page.goto("/en/ai-guide?q=" + encodeURIComponent("Boutique hotel in Bukhara"));
  const card = page.locator("li", { has: page.getByText(/^Hotel$/) }).first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await card.getByRole("button", { name: /Add to trip/i }).click();
  await expect(card.getByRole("button", { name: /Remove from trip/i })).toBeVisible();
});

test("7–9 · inquiry → lead in the CRM → manager moves the stage", async ({ page, request }) => {
  const places = await (await request.get("/api/places?kind=hotel&limit=1")).json();
  const slug = (places.data?.places ?? places.places)[0].slug as string;
  const res = await request.post("/api/service-requests", {
    headers: ip(),
    data: {
      type: "inquiry", topic: "hotel", refSlug: slug, subject: `Hotel request ${run}`, notes: "Two nights for two adults, quiet room please.",
      fullName: `Journey Guest ${run}`, email: `journey-${run}@example.com`, phone: "+998900000099", contactChannel: "email", locale: "en", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  expect(res.status()).toBe(201);
  const reference = (await res.json()).data.reference as string;

  test.skip(!creds, "No local admin account (.smoke-admin.json)");
  await adminLogin(page);
  await page.goto(`/admin/crm?view=table&q=${encodeURIComponent(`Journey Guest ${run}`)}`);
  await page.getByRole("link", { name: new RegExp(`Journey Guest ${run}|Hotel request ${run}`) }).first().click();
  await expect(page).toHaveURL(/\/admin\/crm\/\d+$/);
  await expect(page.getByText(reference).first()).toBeVisible();
  // The admin panel defaults to Uzbek, so the stage button is found by its test id.
  await page.getByTestId("stage-contacted").click();
  await expect(page.getByTestId("stage-contacted")).toHaveAttribute("aria-pressed", "true");
});

test("10–11 · a partner applies and the owner approves", async ({ page, request }) => {
  const res = await request.post("/api/partners", {
    headers: ip(),
    data: {
      type: "guide", businessName: `Silk Thread Guiding ${run}`, contactName: "Journey Partner", email: `partner-${run}@example.com`, phone: "+998900000098",
      destinationSlug: "samarkand", city: "Samarkand", description: "Licensed-style walking tours of the old city in English and Russian, small groups only.",
      services: [{ name: "Old city walk, 3 hours", priceFromUsd: 40, unit: "group" }], locale: "en", consent: true, turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  expect(res.status()).toBe(201);
  const { reference, token } = (await res.json()).data as { reference: string; token?: string };

  test.skip(!creds, "No local admin account (.smoke-admin.json)");
  await adminLogin(page);
  await page.goto(`/admin/partners?q=${encodeURIComponent(reference)}`);
  await page.getByRole("link", { name: new RegExp(`Silk Thread Guiding ${run}|${reference}`) }).first().click();
  await page.getByTestId("partner-approve").click();
  await expect(page.getByTestId("partner-status-badge")).toContainText(/approved|tasdiq/i);
  if (token) {
    await page.goto(`/en/partners/dashboard?ref=${reference}&token=${token}`);
    await expect(page.getByTestId("partner-status")).toContainText(/approved/i);
  }
});

test("12 · main navigation works on this screen size", async ({ page, isMobileProject }) => {
  await page.goto("/en");
  for (const tab of ["Hotels", "Flights & trains", "Ask AI"]) await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  if (isMobileProject) {
    await page.getByRole("button", { name: /menu/i }).first().click();
    await expect(page.getByRole("link", { name: /Trip constructor/i }).first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  for (const path of ["/en/virtual-tours", "/en/trip-builder", "/en/ai-guide", "/en/hotels", "/en/restaurants", "/en/transport?from=Tashkent&to=Samarkand", "/en/navigator", "/en/partners"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(1);
  }
});
