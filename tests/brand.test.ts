import assert from "node:assert/strict";
import { test } from "node:test";
import { BRANDS, brandDeep, brandText, resolveBrandId } from "../src/lib/brand";

test("brand defaults to National Tours so an existing deployment keeps its name", () => {
  assert.equal(resolveBrandId(undefined), "national");
  assert.equal(resolveBrandId("something-else"), "national");
  assert.equal(resolveBrandId("gulistan"), "gulistan");
});

test("canonical texts follow the deployment's brand", () => {
  const nt = BRANDS.national;
  assert.equal(brandText("Become a Gulistan Travel partner", nt), "Become a National Tours partner");
  assert.equal(brandText("https://gulistantravel.uz/en", nt), "https://nationaltours.uz/en");
  assert.equal(brandText("Become a Gulistan Travel partner", BRANDS.gulistan), "Become a Gulistan Travel partner");
  assert.deepEqual(brandDeep({ a: ["Gulistan Travel gidi"], b: 3 }, nt), { a: ["National Tours gidi"], b: 3 });
});
