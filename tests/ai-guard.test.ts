import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { enforceSafeReply, findUnsafeClaims } from "../src/lib/ai/guard";

describe("AI output guard", () => {
  it("flags booking confirmations, guaranteed seats and payment requests in all three languages", () => {
    const bad = [
      "Great news, your booking is confirmed for 12 April!",
      "I have booked the Classic Silk Road tour for you.",
      "Seats are available on that date.",
      "Please send the deposit to our card via Payme.",
      "Broningiz tasdiqlandi, 14-aprelda kutamiz.",
      "Siz uchun bron qildim.",
      "Bo‘sh joylar albatta bor.",
      "Ваше бронирование подтверждено.",
      "Я забронировал для вас тур.",
      "Свободные места точно есть.",
      "Внесите предоплату на карту.",
    ];
    for (const t of bad) assert.ok(findUnsafeClaims(t).length > 0, t);
  });

  it("leaves honest answers untouched", () => {
    const good = [
      "The Classic Silk Road tour costs from $780 per person (indicative). Availability is confirmed by our team after your request.",
      "Narxlar taxminiy. Bo‘sh joyni jamoamiz tasdiqlaydi.",
      "Цены ориентировочные; наличие мест подтверждает команда после заявки.",
      "The train from Samarkand to Bukhara takes about 1 h 40 min.",
      "Samarqandda ko‘plab diqqatga sazovor joylar bor.",
      "В Самарканде интересные места есть на каждом шагу.",
    ];
    for (const t of good) assert.deepEqual(findUnsafeClaims(t), [], t);
  });

  it("appends a correction in the visitor's language", () => {
    const r = enforceSafeReply("Ваше бронирование подтверждено.", "ru");
    assert.deepEqual(r.flagged, ["confirmation"]);
    assert.match(r.text, /ничего не забронировано/);
  });

  it("evaluation set covers UZ, EN and RU with the no-invention checks", () => {
    const qs = JSON.parse(readFileSync(new URL("./ai-eval/questions.json", import.meta.url), "utf8")) as { locale: string; expect: string[] }[];
    for (const l of ["uz", "en", "ru"]) assert.ok(qs.filter((q) => q.locale === l).length >= 4, l);
    assert.ok(qs.some((q) => q.expect.includes("no_confirmation")));
    assert.ok(qs.some((q) => q.expect.includes("no_availability_claim")));
    assert.ok(qs.some((q) => q.expect.includes("no_invented_tour")));
  });
});
