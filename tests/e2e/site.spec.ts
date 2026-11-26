import { expect, settledText, switchCurrency, test } from "./helpers";

const RAW_KEY = /\b(nav|home|common|tours|tour|booking|services|guide|footer|meta|hubs|destinations|errors)\.[a-z][a-zA-Z]+\b/;

test.describe("languages", () => {
  for (const [locale, heading] of [
    ["en", /Silk Road/],
    ["uz", /Ipak yoʻli/],
    ["ru", /Шёлковый путь/],
  ] as const) {
    test(`home renders in ${locale} with lang="${locale}" and no missing translations`, async ({ page }) => {
      const missing: string[] = [];
      page.on("console", (m) => m.text().includes("MISSING_MESSAGE") && missing.push(m.text()));
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1")).toHaveText(heading);
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(RAW_KEY);
      expect(missing).toEqual([]);
    });
  }
});

test("currency switch re-prices the listing and the tour page", async ({ page, isMobileProject }) => {
  await page.goto("/en/tours");
  const firstPrice = page.getByTestId("tour-card-price").first();
  await expect(firstPrice).toContainText("$");
  await switchCurrency(page, "EUR", isMobileProject);
  await expect(firstPrice).toContainText("€");
  await expect(firstPrice).not.toContainText("$");

  await page.goto("/en/tours/classic-silk-road-8-days");
  if (isMobileProject) {
    await expect(page.getByTestId("bar-total")).toContainText("€");
  } else {
    await expect(page.getByTestId("card-total")).toContainText("€");
  }
  await expect(page.getByTestId("price-table")).toContainText("€");
});

test("filters update the URL and the results", async ({ page, isMobileProject }) => {
  await page.goto("/en/tours");
  await expect(page.getByTestId("results-count")).toHaveText("18 tours");
  if (isMobileProject) {
    await page.getByRole("button", { name: /Filters/ }).click();
    await page.locator("#m-audience").selectOption("domestic");
    await page.getByRole("button", { name: "Show results" }).click();
  } else {
    await page.locator("#f-audience").selectOption("domestic");
  }
  await expect(page).toHaveURL(/audience=domestic/);
  await expect(page.getByTestId("results-count")).toHaveText("7 tours");
  if (isMobileProject) {
    await page.getByRole("button", { name: /Filters/ }).click();
    await page.locator("#m-month").selectOption("7");
    await page.getByRole("button", { name: "Show results" }).click();
  } else {
    await page.locator("#f-month").selectOption("7");
  }
  await expect(page).toHaveURL(/month=7/);
  await expect(page.getByTestId("tour-results").locator("li").first()).toBeVisible();
  // The URL alone restores the same filtered view.
  await page.reload();
  await expect(page.getByTestId("results-count")).not.toHaveText("18 tours");
});

test("tour page: live price, departure choice and a complete booking", async ({ page, isMobileProject }) => {
  await page.goto("/en/tours/classic-silk-road-8-days");
  const p = isMobileProject ? "sheet" : "card";
  if (isMobileProject) await page.getByTestId("bar-book").click();
  const total = `[data-testid=${p}-total]`;
  const t0 = await settledText(page, total);

  await page.getByTestId(`${p}-adults-inc`).click();
  await expect(page.locator(total)).not.toHaveText(t0);
  const t1 = await settledText(page, total);

  await page.getByTestId(`${p}-type-private`).click();
  await expect(page.locator(total)).not.toHaveText(t1);

  await page.getByTestId(`${p}-type-group`).click();
  // Pick the first departure that still has room for the 3 travellers (earlier test runs may have filled some).
  const chips = page.getByTestId(`${p}-departure-chip`);
  await expect(chips.first()).toBeVisible();
  let picked = false;
  for (let i = 0; i < (await chips.count()); i++) {
    const seats = Number(/(\d+) seats? left/.exec((await chips.nth(i).textContent()) ?? "")?.[1] ?? 0);
    if (seats >= 3) {
      await chips.nth(i).click();
      picked = true;
      break;
    }
  }
  expect(picked, "no departure chip with 3 free seats").toBe(true);
  await expect(page.getByTestId(`${p}-selected-departure`)).toBeVisible();
  await settledText(page, total);
  await page.getByTestId(`${p}-book`).click();

  await expect(page).toHaveURL(/\/en\/book\/classic-silk-road-8-days\?.*departureId=\d+/);
  await expect(page.getByTestId("book-total")).toContainText("$");
  await page.getByTestId("book-next").click();
  await page.getByLabel("Full name").fill("E2E Traveller");
  await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
  await page.getByLabel("Phone with country code").fill("+998 90 765 43 21");
  await page.getByTestId("book-next").click();
  await expect(page.getByTestId("review-total")).toContainText("$");
  await expect(page.locator("input[name=cf-turnstile-response]")).toHaveValue(/.+/, { timeout: 30_000 });
  await page.getByTestId("book-submit").click();

  await expect(page).toHaveURL(/\/en\/booking\/UZ-\d{4}-\d{5}$/);
  await expect(page.getByTestId("booking-reference")).toHaveText(/^UZ-\d{4}-\d{5}$/);
  await expect(page.getByTestId("booking-status")).toHaveText("Waiting for confirmation");
});

test("airport transfer request gets an SR reference", async ({ page }) => {
  const day = new Date(Date.now() + 12 * 86400_000).toISOString().slice(0, 10);
  await page.goto("/en/services/airport-transfer");
  await page.getByLabel("Date").fill(day);
  await page.getByLabel("Time (local)").fill("14:30");
  await page.getByLabel("Flight number").fill("HY 602");
  await page.getByLabel("Hotel or address").fill("Hotel in central Tashkent");
  await page.getByLabel("Full name").fill("E2E Transfer");
  await page.getByRole("textbox", { name: "Email" }).fill("transfer@example.com");
  await page.getByLabel("Phone with country code").fill("+998901112233");
  await expect(page.locator("input[name=cf-turnstile-response]")).toHaveValue(/.+/, { timeout: 30_000 });
  await page.getByTestId("service-submit").click();
  await expect(page.getByTestId("service-reference")).toHaveText(/^SR-\d{4}-\d{5}$/);
});

test("validation errors are shown inline in the visitor's language and keep their input", async ({ page }) => {
  await page.goto("/ru/book/zomin-weekend-mountain-getaway");
  await expect(page.getByTestId("book-departure")).toBeVisible();
  await page.getByTestId("book-departure").selectOption({ index: 1 });
  await page.getByTestId("book-next").click();
  await page.locator("#fullName").fill("А");
  await page.locator("#email").fill("not-an-email");
  await page.locator("#phone").fill("12");
  await page.getByTestId("book-next").click();
  await expect(page.locator("#email-error")).toHaveText("Введите корректный email.");
  await expect(page.locator("#fullName-error")).toBeVisible();
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#fullName")).toHaveValue("А");
  await expect(page.locator("#email")).toHaveValue("not-an-email");
});
