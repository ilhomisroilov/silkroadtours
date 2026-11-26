import { expect, type Page, test as base } from "@playwright/test";

const rand = (n: number) => Math.floor(Math.random() * n);

/**
 * Every test gets its own fake client IP (sent only to this site's /api), so the
 * 5-submissions-per-10-minutes spam limit never blocks the test suite.
 */
export const test = base.extend<{ isMobileProject: boolean }>({
  isMobileProject: async ({}, use, info) => use(info.project.name === "mobile"),
  page: async ({ page, baseURL }, use) => {
    const ip = `10.${rand(255)}.${rand(255)}.${rand(255)}`;
    await page.route(`${baseURL}/api/**`, (route) => route.continue({ headers: { ...route.request().headers(), "cf-connecting-ip": ip, "x-real-ip": ip } }));
    await use(page);
  },
});
export { expect };

/** Opens the currency switcher (header on desktop, menu sheet on mobile) and picks a currency. */
export async function switchCurrency(page: Page, currency: "USD" | "UZS" | "EUR", mobile: boolean) {
  if (mobile) {
    await page.getByRole("button", { name: /open menu|menyuni ochish|открыть меню/i }).click();
    await page.getByRole("dialog").getByTestId("currency-switcher").click();
  } else {
    // On desktop the currency choice sits in the header's language menu.
    await page.locator("header").getByRole("button", { name: /Choose language/ }).click();
  }
  await page.getByTestId(`currency-option-${currency}`).click();
}

/** Text of an element once it has settled (the live quote debounces). */
export async function settledText(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  let last = "";
  for (let i = 0; i < 10; i++) {
    const now = (await el.textContent()) ?? "";
    if (now === last && now) return now;
    last = now;
    await page.waitForTimeout(300);
  }
  return last;
}

/** Waits until the booking form is hydrated, so a choice made right after load is not lost. */
export async function bookingReady(page: Page) {
  await expect(page.locator("[data-testid=booking-form][data-ready]")).toBeAttached();
}
