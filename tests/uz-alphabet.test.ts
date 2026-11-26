import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toNewUzbek, uzDeep } from "../src/lib/uz-alphabet.ts";

describe("new Uzbek alphabet", () => {
  it("converts oʻ, gʻ, sh and ch in every apostrophe and letter case", () => {
    assert.equal(toNewUzbek("Oʻzbekistonning goʻzalligini kashf eting"), "Özbekistonning gözalligini kaşf eting");
    assert.equal(toNewUzbek("Choʻl, choyxona, SHAHAR, G'ijduvon, o‘zbek"), "Çöl, çoyxona, ŞAHAR, Ğijduvon, özbek");
  });
  it("is idempotent and keeps the tutuq belgisi (ʼ)", () => {
    const once = toNewUzbek("maʼlumot, sanʼat, shahar");
    assert.equal(once, "maʼlumot, sanʼat, şahar");
    assert.equal(toNewUzbek(once), once);
  });
  it("never changes links, paths, e-mail, ICU arguments or foreign words", () => {
    assert.equal(toNewUzbek("[Shahrisabz](/uz/destinations/shahrisabz) https://x.uz/chimgan info@chorsu.uz"), "[Şahrisabz](/uz/destinations/shahrisabz) https://x.uz/chimgan info@chorsu.uz");
    assert.equal(toNewUzbek("{count, plural, one {# kecha} other {# kecha}} {chosen}"), "{count, plural, one {# keça} other {# keça}} {chosen}");
    assert.equal(toNewUzbek("{kind, select, shop {Doʻkon} other {Boshqa}}"), "{kind, select, shop {Dökon} other {Boşqa}}");
    assert.equal(toNewUzbek("check-in, Wi-Fi, How much"), "check-in, Wi-Fi, How much");
  });
  it("converts nested message trees", () => {
    assert.deepEqual(uzDeep({ a: ["Toshkent"], b: { c: "Chorvoq" }, n: 3 }), { a: ["Toşkent"], b: { c: "Çorvoq" }, n: 3 });
  });
});
