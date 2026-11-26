import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../src/lib/auth/password";
import { hashIp, timingSafeEqualString } from "../src/lib/crypto";
import { parseCbuRates } from "../src/lib/rates-cbu";
import { generateReference, isValidReference, withUniqueReference } from "../src/lib/reference";
import { escapeHtml, formatBookingMessage, sendTelegramMessage } from "../src/lib/telegram";
import { verifyTurnstile } from "../src/lib/turnstile";

const jsonFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("passwords", () => {
  it("hashes with PBKDF2 and verifies only the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.match(hash, /^pbkdf2-sha256\$100000\$/);
    assert.equal(await verifyPassword("correct horse battery", hash), true);
    assert.equal(await verifyPassword("wrong password!!", hash), false);
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
    assert.equal(await verifyPassword("anything", DUMMY_PASSWORD_HASH), false);
  });

  it("refuses passwords shorter than 12 characters", async () => {
    await assert.rejects(hashPassword("short"));
  });

  it("compares secrets in constant time and hashes IPs consistently", async () => {
    assert.equal(timingSafeEqualString("abc", "abc"), true);
    assert.equal(timingSafeEqualString("abc", "abd"), false);
    assert.equal(await hashIp("1.2.3.4", "s"), await hashIp("1.2.3.4", "s"));
    assert.notEqual(await hashIp("1.2.3.4", "s"), await hashIp("1.2.3.4", "t"));
  });
});

describe("booking references", () => {
  it("have the UZ-YYYY-NNNNN format", () => {
    const ref = generateReference("UZ");
    assert.equal(isValidReference(ref), true);
    assert.equal(isValidReference("UZ-2026-1234"), false);
  });

  it("are retried when a collision happens", async () => {
    let attempts = 0;
    const ref = await withUniqueReference(
      "SR",
      async (r) => {
        attempts++;
        if (attempts < 3) throw new Error("UNIQUE constraint failed: service_requests.reference");
        return r;
      },
      (e) => String(e).includes("UNIQUE"),
    );
    assert.equal(attempts, 3);
    assert.match(ref, /^SR-\d{4}-\d{5}$/);
  });
});

describe("Telegram notifications", () => {
  const booking = {
    id: 7,
    reference: "UZ-2026-12345",
    audience: "inbound" as const,
    bookingType: "private" as const,
    tourTitle: "Classic <Silk> Road & more",
    destinationName: null,
    preferredDate: "2027-04-10",
    adults: 2,
    children: 1,
    fullName: "Anna <script>",
    email: "a@b.com",
    phone: "+998901234567",
    contactChannel: "telegram" as const,
    messengerHandle: "@anna_travel",
    country: "Germany",
    locale: "en" as const,
    specialRequests: "Vegetarian",
    quote: { totalMinor: 154400, currency: "USD" as const },
  };

  it("escapes customer input so it cannot inject HTML", () => {
    const msg = formatBookingMessage(booking, "https://example.com/");
    assert.ok(!msg.includes("<script>"));
    assert.ok(msg.includes("Anna &lt;script&gt;"));
    assert.ok(msg.includes("Classic &lt;Silk&gt; Road &amp; more"));
    assert.equal(escapeHtml(`"<&>`), "&quot;&lt;&amp;&gt;");
  });

  it("includes contact links, the quote and the admin link", () => {
    const msg = formatBookingMessage(booking, "https://example.com/");
    assert.ok(msg.includes("https://wa.me/998901234567"));
    assert.ok(msg.includes("https://t.me/anna_travel"));
    assert.ok(msg.includes("$1,544"));
    assert.ok(msg.includes("https://example.com/admin/bookings/7"));
  });

  it("reports success, API errors and missing configuration", async () => {
    const okRes = await sendTelegramMessage({ botToken: "t", chatId: "-1" }, "hi", jsonFetch({ ok: true, result: { message_id: 42 } }));
    assert.deepEqual(okRes, { ok: true, messageId: 42 });
    const err = await sendTelegramMessage({ botToken: "t", chatId: "1" }, "hi", jsonFetch({ ok: false, description: "chat not found" }, 400));
    assert.deepEqual(err, { ok: false, error: "chat not found" });
    const missing = await sendTelegramMessage({ botToken: "", chatId: "" }, "hi", jsonFetch({}));
    assert.equal(missing.ok, false);
  });
});

describe("Turnstile and exchange rates", () => {
  it("passes only when Cloudflare says success", async () => {
    assert.deepEqual(await verifyTurnstile("tok", "secret", null, jsonFetch({ success: true })), { ok: true });
    const bad = await verifyTurnstile("tok", "secret", null, jsonFetch({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    assert.deepEqual(bad, { ok: false, codes: ["timeout-or-duplicate"] });
    assert.equal((await verifyTurnstile("tok", "", null, jsonFetch({ success: true }))).ok, false);
  });

  it("answers Cloudflare's documented test secret keys without a network call", async () => {
    const noNetwork = (async () => {
      throw new Error("network must not be used for test keys");
    }) as unknown as typeof fetch;
    assert.deepEqual(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX", "1x0000000000000000000000000000000AA", null, noNetwork), { ok: true });
    assert.equal((await verifyTurnstile("tok", "2x0000000000000000000000000000000AA", null, noNetwork)).ok, false);
    assert.equal((await verifyTurnstile("tok", "3x0000000000000000000000000000000AA", null, noNetwork)).ok, false);
    // An empty token is refused even with the always-pass test key.
    assert.equal((await verifyTurnstile("", "1x0000000000000000000000000000000AA", null, noNetwork)).ok, false);
    // A real secret still goes to Cloudflare.
    assert.deepEqual(await verifyTurnstile("tok", "0x4AAAAAAA-real-secret", null, jsonFetch({ success: false, "error-codes": ["invalid-input-secret"] })), { ok: false, codes: ["invalid-input-secret"] });
  });

  it("converts Central Bank rates to a USD base", () => {
    const r = parseCbuRates([
      { Ccy: "USD", Nominal: "1", Rate: "11973.44" },
      { Ccy: "EUR", Nominal: "1", Rate: "13900.10" },
    ]);
    assert.equal(r.rates.UZS, 11973.44);
    assert.equal(r.rates.EUR, 0.8614);
    assert.throws(() => parseCbuRates([{ Ccy: "USD", Rate: "x" }]));
  });
});
