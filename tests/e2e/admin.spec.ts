import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "./helpers";

const creds = existsSync(".smoke-admin.json") ? (JSON.parse(readFileSync(".smoke-admin.json", "utf8")) as { email: string; password: string }) : null;
const seatsLeft = (s: string) => Number(/(\d+)\s*(ta joy|seats)/.exec(s)?.[1] ?? NaN);

test("admin: sign in, see a new booking, confirm it (seats go down), sign out", async ({ page, request, isMobileProject }) => {
  test.skip(!creds, "No local admin account (.smoke-admin.json); run the smoke test or set ADMIN_SECRET in .dev.vars");
  // 1. A customer books (via the public API) — a different departure per project so runs don't interfere.
  const slug = "classic-silk-road-8-days";
  const detail = await (await request.get(`/api/tours/${slug}`)).json();
  const departure = detail.data.tour.departures.filter((d: { seatsTotal: number; seatsBooked: number; status: string }) => d.status !== "sold_out" && d.seatsTotal - d.seatsBooked >= 2)[isMobileProject ? 3 : 2];
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.9`;
  const res = await request.post("/api/bookings", {
    headers: { "cf-connecting-ip": ip },
    data: {
      tourSlug: slug, departureId: departure.id, bookingType: "group", fullName: "Admin Flow Guest", email: "adminflow@example.com",
      phone: "+998901234567", contactChannel: "telegram", messengerHandle: "@adminflow", preferredDate: departure.startDate,
      adults: 2, children: 0, currency: "USD", locale: "en", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  expect(res.status()).toBe(201);
  const reference = (await res.json()).data.reference as string;

  // 2. Admin signs in (the panel is in Uzbek by default).
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator("#email").fill(creds!.email);
  await page.locator("#password").fill(creds!.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");

  // 3. The booking is in the list.
  await page.goto(`/admin/bookings?q=${reference}`);
  const row = page.getByTestId("admin-bookings").getByRole("link", { name: reference });
  await expect(row).toBeVisible();
  await row.click();

  // 4. Confirm it: two seats are reserved on the departure.
  const seats = page.getByTestId("admin-departure-seats");
  const before = seatsLeft((await seats.textContent()) ?? "");
  await page.getByTestId("status-select").selectOption("confirmed");
  await page.getByTestId("status-apply").click();
  await expect(page.getByTestId("status-badge")).toHaveText("Tasdiqlangan");
  await expect(seats).toContainText(`${before - 2} ta joy`);

  // 5. The public confirmation page reflects the new status.
  const pub = await (await request.get(`/api/bookings/${reference}`)).json();
  expect(pub.data.status).toBe("confirmed");

  // 6. Sign out; the panel is protected again.
  if (isMobileProject) await page.getByRole("button", { name: "Boshqaruv menyusi" }).first().click();
  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin: wrong password is refused", async ({ page }) => {
  await page.goto("/admin/login");
  await page.locator("#email").fill("nobody@example.com");
  await page.locator("#password").fill("definitely-not-the-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toBeVisible();
});
