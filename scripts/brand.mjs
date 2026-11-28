// Brand values for Node scripts (db.mjs, seed builder). Keep in sync with src/lib/brand.ts.
export const BRANDS = {
  national: { name: "National Tours", domain: "nationaltours.uz", email: "" },
  gulistan: { name: "Gulistan Travel", domain: "gulistantravel.uz", email: "info@gulistantravel.uz" },
};
export const CANONICAL_NAME = "Gulistan Travel";
export const brand = BRANDS[process.env.NEXT_PUBLIC_BRAND === "gulistan" ? "gulistan" : "national"];
export function brandText(text) {
  if (brand.name === CANONICAL_NAME) return text;
  return text.replaceAll(CANONICAL_NAME, brand.name).replaceAll("gulistantravel.uz", brand.domain);
}
