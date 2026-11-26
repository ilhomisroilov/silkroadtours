import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currencyCookie, isCurrency, resolveCurrency } from "../src/lib/currency";
import { formatDateLabel, monthRanges, toQuery } from "../src/lib/format";
import { imageExists } from "../src/lib/images";
import { messengerLinks } from "../src/lib/links";
import { filterValuesFrom, parseTourSearchParams } from "../src/lib/tour-query";

const short = (m: number) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]!;

describe("currency preference", () => {
  it("a valid CURRENCY cookie always wins", () => {
    assert.equal(resolveCurrency({ cookie: "EUR", locale: "uz" }), "EUR");
    assert.equal(resolveCurrency({ cookie: "USD", locale: "en", context: "domestic" }), "USD");
  });
  it("defaults to so'm on Uzbek pages and on the domestic hub when there is no cookie", () => {
    assert.equal(resolveCurrency({ locale: "uz" }), "UZS");
    assert.equal(resolveCurrency({ locale: "en", context: "domestic" }), "UZS");
  });
  it("otherwise uses the site default, falling back to USD", () => {
    assert.equal(resolveCurrency({ locale: "en", siteDefault: "EUR" }), "EUR");
    assert.equal(resolveCurrency({ locale: "ru", siteDefault: "GBP" }), "USD");
    assert.equal(resolveCurrency({ locale: "en", cookie: "BTC" }), "USD");
  });
  it("writes a long-lived, site-wide cookie (Secure on https)", () => {
    assert.equal(isCurrency("UZS"), true);
    assert.equal(isCurrency("uzs"), false);
    const c = currencyCookie("UZS", true);
    assert.match(c, /^CURRENCY=UZS; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
    assert.ok(!currencyCookie("EUR", false).includes("Secure"));
  });
});

describe("tour listing URL", () => {
  it("keeps valid filters and ignores the currency in the URL", () => {
    const q = parseTourSearchParams({ audience: "domestic", month: "7", guests: "4", sort: "price_asc", currency: "EUR" }, "UZS");
    assert.equal(q.audience, "domestic");
    assert.equal(q.month, 7);
    assert.equal(q.guests, 4);
    assert.equal(q.sort, "price_asc");
    assert.equal(q.currency, "UZS");
  });
  it("drops invalid values instead of failing", () => {
    const q = parseTourSearchParams({ month: "13", audience: "martians", destination: "Not A Slug", page: "-1", q: "  " }, "USD");
    assert.equal(q.month, undefined);
    assert.equal(q.audience, undefined);
    assert.equal(q.destination, undefined);
    assert.equal(q.page, 1);
    assert.equal(q.q, undefined);
  });
  it("round-trips back to form values without the default sort", () => {
    const v = filterValuesFrom(parseTourSearchParams({ category: "trekking", sort: "featured" }, "USD"));
    assert.equal(v.category, "trekking");
    assert.equal(v.sort, undefined);
  });
});

describe("messenger links", () => {
  it("builds WhatsApp, Telegram and phone links with the reference text", () => {
    const l = messengerLinks({ whatsapp: "+998 90 123-45-67", telegram: "@silkroad_uz", phone: "+998 (90) 123 45 67" }, "Ref UZ-2026-12345");
    assert.equal(l.whatsapp, "https://wa.me/998901234567?text=Ref%20UZ-2026-12345");
    assert.equal(l.telegram, "https://t.me/silkroad_uz?text=Ref%20UZ-2026-12345");
    assert.equal(l.phone, "tel:+998901234567");
  });
  it("hides buttons for empty settings and accepts full t.me links", () => {
    assert.deepEqual(messengerLinks({ whatsapp: "", telegram: "", phone: "" }), { whatsapp: null, telegram: null, phone: null });
    assert.equal(messengerLinks({ whatsapp: "", telegram: "https://t.me/agency", phone: "" }).telegram, "https://t.me/agency");
  });
});

describe("images and formatting", () => {
  it("treats https URLs as present and /images paths as present only if built", () => {
    const known = new Set(["/images/tours/a.jpg"]);
    assert.equal(imageExists("https://cdn.example.com/x.jpg", known), true);
    assert.equal(imageExists("/images/tours/a.jpg?v=2", known), true);
    assert.equal(imageExists("/images/tours/missing.jpg", known), false);
    assert.equal(imageExists("", known), false);
    assert.equal(imageExists("javascript:alert(1)", known), false);
  });
  it("formats dates and month ranges", () => {
    assert.equal(formatDateLabel("2027-04-09", short), "9 Apr 2027");
    assert.equal(formatDateLabel("2027-04-09", short, false), "9 Apr");
    assert.equal(monthRanges([4, 5, 6, 9, 10], short), "Apr–Jun, Sep–Oct");
    assert.equal(monthRanges([12, 1, 2], short), "Dec–Feb");
    assert.equal(monthRanges([], short), "");
    assert.equal(monthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], short), "");
    assert.equal(toQuery({ a: 1, b: "", c: undefined, d: "x y" }), "?a=1&d=x+y");
  });
});
