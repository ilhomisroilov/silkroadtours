import { expect, test } from "@playwright/test";

// Needs the accounts service (backend/) reachable from the site (ACCOUNTS_API_URL); skipped otherwise.
test("traveller signs up, books while signed in, sees the booking, signs out", async ({ page, request }) => {
  const providers = await request.get("/v1/auth/providers");
  test.skip(!providers.ok(), "accounts service is not running");

  await page.goto("/uz");
  await page.getByTestId("account-link").click();
  await expect(page.getByTestId("account-signin")).toBeVisible();
  await page.getByTestId("account-tab-up").click();
  await page.locator("#up-name").fill("Ali Valiyev");
  await page.locator("#up-email").fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.locator("#up-password").fill("correct horse battery");
  await page.getByTestId("account-submit-up").click();
  await expect(page.getByTestId("account-signed-in")).toBeVisible();
  await expect(page.getByTestId("account-link")).toHaveText("A");

  const slug = "classic-silk-road-8-days";
  const detail = await (await page.request.get(`/api/tours/${slug}`)).json();
  const dep = detail.data.tour.departures.find((d: { status: string; seatsTotal: number; seatsBooked: number }) => d.status !== "sold_out" && d.seatsTotal - d.seatsBooked >= 2);
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.21`;
  const res = await page.request.post("/api/bookings", {
    headers: { "x-real-ip": ip },
    data: {
      tourSlug: slug, departureId: dep.id, bookingType: "group", fullName: "Ali Valiyev", email: "another-address@example.com",
      phone: "+998901234567", contactChannel: "telegram", messengerHandle: "@ali", preferredDate: dep.startDate,
      adults: 2, children: 0, currency: "USD", locale: "uz", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  expect(res.status()).toBe(201);
  const { reference } = (await res.json()).data;
  await page.reload();
  await expect(page.getByTestId("account-booking").filter({ hasText: reference })).toBeVisible();

  await page.getByTestId("account-signout").click();
  await expect(page.getByTestId("account-signin")).toBeVisible();
  expect((await page.request.get("/api/account/bookings")).status()).toBe(401);
});
