import { existsSync, readFileSync } from "node:fs";
import { bookingReady, expect, test } from "./helpers";

/**
 * The ten acceptance workflows (A–J), run in order on the desktop project:
 * visitor → AI → visitor edits a plan → admin sees, updates and edits → AI monitoring → languages.
 * Runs against any AI provider; with AI_PROVIDER=mock the planner uses the catalogue fallback.
 */
const creds = existsSync(".smoke-admin.json") ? (JSON.parse(readFileSync(".smoke-admin.json", "utf8")) as { email: string; password: string }) : null;
const state: { bookingRef?: string; requestRef?: string; conversationId?: string; question?: string } = {};
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

test.describe.serial("acceptance workflows A–J", () => {
  test.beforeEach(({ isMobileProject }) => test.skip(isMobileProject, "workflows run once, on desktop"));

  test("A: visitor searches, opens a tour and sends a booking request", async ({ page }) => {
    await page.goto("/en/tours?q=samarkand");
    const cards = page.getByTestId("tour-results").locator("li");
    await expect(cards.first()).toBeVisible();
    await cards.first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/tours\/[a-z0-9-]+$/);
    const slug = page.url().split("/").pop()!;
    await page.goto(`/en/book/${slug}`);
    await bookingReady(page);
    // A private trip on a date of the visitor's choice (group tours need a scheduled departure).
    const privateType = page.getByTestId("book-type-private");
    if (await privateType.count()) await privateType.check();
    await page.getByTestId("book-date").fill(inDays(40));
    await page.getByTestId("book-next").click();
    await page.getByLabel("Full name").fill("Workflow Visitor");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("workflow-a@example.com");
    await page.getByLabel("Phone with country code").fill("+998 90 555 11 22");
    await page.getByTestId("book-next").click();
    await page.getByTestId("book-submit").click();
    await expect(page.getByTestId("booking-reference")).toHaveText(/^UZ-\d{4}-\d{5}$/);
    state.bookingRef = (await page.getByTestId("booking-reference").textContent())!.trim();
  });

  test("B: AI plans a 5-day trip within a budget", async ({ request }) => {
    const res = await request.post("/api/ai/planner", { data: { request: "5-day trip to Samarkand and Bukhara for two, culture and food", locale: "en", days: 5, budgetUsd: 1500 } });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.plan.days.length).toBe(5);
    expect(data.budgetUsd).toBe(1500);
    expect(data.plan.budget.currency).toBe("USD");
    for (const s of data.plan.suggestedTours as { slug: string }[]) {
      const tour = await request.get(`/api/tours/${s.slug}`);
      expect(tour.status(), `suggested tour ${s.slug} exists`).toBe(200);
    }
  });

  test("C: AI answers from the tour and destination database", async ({ request }) => {
    state.question = `Which tours do you have in Samarkand? (${Date.now()})`;
    const res = await request.post("/api/ai/chat", { data: { message: state.question, locale: "en" } });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    state.conversationId = data.conversationId;
    const links = [...(data.text as string).matchAll(/\]\((\/en\/tours\/[a-z0-9-]+)\)/g)].map((m) => m[1]!);
    const cards = (data.cards ?? []) as { url: string }[];
    const urls = [...links, ...cards.map((c) => c.url)];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls.slice(0, 3)) expect((await request.get(u)).status(), u).toBe(200);
  });

  test("D: visitor edits an AI itinerary and sends it as a request", async ({ page }) => {
    await page.goto("/en/planner");
    await page.getByRole("button", { name: /5-day family trip/ }).click();
    await page.getByRole("button", { name: "Build my plan" }).click();
    const days = page.locator("#plan-result article ol > li");
    await expect(days.first()).toBeVisible({ timeout: 90_000 });
    const before = await days.count();
    await page.getByRole("button", { name: /Remove this day: Day 2/ }).click();
    await expect(days).toHaveCount(before - 1);
    await page.getByLabel("Start date").fill(inDays(30));
    await page.getByLabel("What would you like to change?").fill("Please add a cooking class in Bukhara");
    await page.getByLabel("Full name").fill("Workflow Planner");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("workflow-d@example.com");
    await page.getByLabel("Phone with country code").fill("+998901112244");
    await page.getByTestId("service-submit").click();
    await expect(page.getByTestId("service-reference")).toHaveText(/^SR-\d{4}-\d{5}$/);
    state.requestRef = (await page.getByTestId("service-reference").textContent())!.trim();
  });

  test("E–I: admin sees the request, updates the booking, edits a tour and reviews AI", async ({ page, request }) => {
    test.skip(!creds || !state.bookingRef || !state.requestRef, "needs .smoke-admin.json and workflows A and D");
    await page.context().addCookies([{ name: "ADMIN_LOCALE", value: "en", url: new URL(page.url() === "about:blank" ? "http://localhost:3000" : page.url()).origin + "/admin" }]);
    await page.goto("/admin/login");
    await page.locator("#email").fill(creds!.email);
    await page.locator("#password").fill(creds!.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/admin$/);

    // E: the edited plan arrives as a request, with the requested change in it.
    await page.goto("/admin/requests");
    await page.getByRole("link", { name: state.requestRef! }).click();
    await expect(page.locator("main")).toContainText("cooking class in Bukhara");

    // F: the booking from workflow A is confirmed.
    await page.goto(`/admin/bookings?q=${state.bookingRef}`);
    await page.getByTestId("admin-bookings").getByRole("link", { name: state.bookingRef! }).click();
    await page.getByTestId("status-select").selectOption("confirmed");
    await page.getByTestId("status-apply").click();
    await expect(page.getByTestId("status-badge")).toHaveText("Confirmed");
    expect((await (await request.get(`/api/bookings/${state.bookingRef}`)).json()).data.status).toBe("confirmed");

    // G: editing a tour title in the admin changes the public page.
    const slug = "samarkand-family-weekend-by-afrosiyob";
    await page.goto("/admin/tours");
    await page.getByRole("link", { name: /Samarkand/ }).first().waitFor();
    const editHref = await page.locator(`a[href^="/admin/tours/"]`).filter({ hasText: /Afrosiyob/ }).first().getAttribute("href");
    await page.goto(editHref!);
    const title = page.locator("fieldset", { has: page.locator("legend", { hasText: "Title" }) }).locator("input").first();
    const original = (await title.inputValue()).replace(/( ✦)+$/, "");
    const edited = `${original} ✦`;
    await title.fill(edited);
    await page.getByTestId("tour-save").click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    try {
      await expect.poll(async () => (await request.get(`/en/tours/${slug}`)).text(), { timeout: 60_000 }).toContain(edited);
    } finally {
      // Always put the title back, even when the check above fails.
      await title.fill(original);
      await page.getByTestId("tour-save").click();
      await expect(page.getByText("Saved").first()).toBeVisible();
    }

    // H: the AI conversation from workflow C is visible with its question.
    await page.goto("/admin/ai");
    await expect(page.locator("main")).toContainText("Provider");
    await page.goto(`/admin/ai/${state.conversationId}`);
    await expect(page.locator("main")).toContainText(state.question!.slice(0, 30));

    // I: stored usage metrics are shown (conversations, replies, provider breakdown, tool calls).
    await page.goto("/admin/ai");
    const tiles = page.locator("main");
    await expect(tiles).toContainText(/Conversations\s*\d+/);
    await expect(tiles).toContainText("search_tours");
  });

  test("J: switching between English, Uzbek and Russian", async ({ page }) => {
    for (const [locale, word] of [["en", "Tours"], ["uz", "Turlar"], ["ru", "Туры"]] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("header")).toContainText(word);
    }
    await page.goto("/en/tours/samarkand-family-weekend-by-afrosiyob");
    await page.locator("header").getByRole("button", { name: /Choose language/ }).click();
    await page.getByRole("link", { name: "Oʻzbekcha" }).click();
    await expect(page).toHaveURL(/\/uz\/tours\/samarkand-family-weekend-by-afrosiyob/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  });
});
