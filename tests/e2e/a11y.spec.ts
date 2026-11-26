import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "./helpers";

const PAGES = [
  "/en",
  "/uz",
  "/ru",
  "/en/tours",
  "/en/tours/classic-silk-road-8-days",
  "/uz/tours/zomin-weekend-mountain-getaway",
  "/en/destinations",
  "/ru/destinations/samarkand",
  "/en/inbound",
  "/uz/domestic",
  "/en/services",
  "/en/services/airport-transfer",
  "/ru/services/tailor-made",
  "/en/services/accommodation",
  "/uz/services/guides",
  "/en/travel-guide",
  "/en/reviews/new",
  "/en/about",
  "/en/contact",
  "/en/book/classic-silk-road-8-days",
  "/en/no-such-page",
  "/admin/login",
];

async function audit(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page: page as never })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Third-party frames we don't control (Cloudflare Turnstile, map tiles).
    .exclude("[data-testid=turnstile]")
    .exclude(".leaflet-container")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const path of PAGES) {
  test(`no serious or critical axe violations: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await audit(page)).toEqual([]);
  });
}

test("no serious or critical axe violations: booking confirmation and admin panel", async ({ page, request }) => {
  const detail = await (await request.get("/api/tours/samarkand-bukhara-express")).json();
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.77`;
  const res = await request.post("/api/bookings", {
    headers: { "cf-connecting-ip": ip },
    data: {
      tourSlug: "samarkand-bukhara-express", bookingType: detail.data.pricing[0].bookingType, fullName: "Axe Guest", email: "axe@example.com",
      phone: "+998901234567", contactChannel: "email", preferredDate: new Date(Date.now() + 40 * 86400_000).toISOString().slice(0, 10),
      adults: 2, children: 0, currency: "EUR", locale: "en", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  expect(res.status()).toBe(201);
  await page.goto(`/en/booking/${(await res.json()).data.reference}`);
  expect(await audit(page)).toEqual([]);

  const creds = existsSync(".smoke-admin.json") ? JSON.parse(readFileSync(".smoke-admin.json", "utf8")) : null;
  test.skip(!creds, "no local admin account");
  await page.goto("/admin/login");
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const path of ["/admin", "/admin/bookings", "/admin/tours/1", "/admin/settings"]) {
    await page.goto(path);
    expect(await audit(page), path).toEqual([]);
  }
});
