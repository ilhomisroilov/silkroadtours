/**
 * Writes the ornament library as static, cacheable SVG files in public/ornament/ from the same
 * geometry as src/components/ornament/geometry.ts. Pages reference these files (CSS backgrounds
 * and <img>) instead of inlining large SVG markup, which keeps the HTML small.
 *
 *   npx tsx scripts/build-ornaments.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { archPath, girihTile, ikatDiamondPath, islimiRepeat, khatamPath, polygonPath } from "../src/components/ornament/geometry.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ornament");
mkdirSync(OUT, { recursive: true });

const C = {
  lapis: "#1F3A93",
  lapisDeep: "#14235C",
  turquoise: "#2A9D8F",
  saffron: "#D4A24C",
  pomegranate: "#9E2A3A",
  sand: "#E9D8B8",
  ivory: "#FAF6EF",
  ink: "#1E1A16",
};
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
const write = (name: string, content: string) => writeFileSync(join(OUT, name), content);

// Girih lattice tiles (full opacity; components set opacity with CSS).
const TILE = 120;
const tones = { saffron: C.saffron, lapis: C.lapis, turquoise: C.turquoise, ivory: C.ivory, pomegranate: C.pomegranate, ink: C.ink };
for (const [name, color] of Object.entries(tones)) {
  write(`pattern-${name}.svg`, svg(TILE, TILE, `<path d="${girihTile(TILE)}" fill="none" stroke="${color}" stroke-width="1.1" stroke-linejoin="round"/>`));
}
// Dimmed tiles used by the .bg-girih-dark / .bg-girih-light utility classes.
write("girih-saffron.svg", svg(TILE, TILE, `<path d="${girihTile(TILE)}" fill="none" stroke="${C.saffron}" stroke-opacity="0.32" stroke-width="1" stroke-linejoin="round"/>`));
write("girih-lapis.svg", svg(TILE, TILE, `<path d="${girihTile(TILE)}" fill="none" stroke="${C.lapis}" stroke-opacity="0.09" stroke-width="1" stroke-linejoin="round"/>`));

// Islimi vine-scroll border tile.
const isl = islimiRepeat();
for (const [name, color] of Object.entries({ saffron: C.saffron, lapis: C.lapis })) {
  write(
    `islimi-${name}.svg`,
    svg(120, 32, `<path d="${isl.stem}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/><path d="${isl.leaves}" fill="${color}"/>${isl.buds.map((b) => `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${color}"/>`).join("")}`),
  );
}

// Ikat stripe tile: feathered diamonds in alternating colours.
write(
  "ikat.svg",
  svg(
    44,
    18,
    `<path d="${ikatDiamondPath(11, 9, 10, 8, 2)}" fill="${C.pomegranate}"/><path d="${ikatDiamondPath(11, 9, 4.5, 3.5, 1.5)}" fill="${C.saffron}"/>` +
      `<path d="${ikatDiamondPath(33, 9, 10, 8, 2)}" fill="${C.lapis}"/><path d="${ikatDiamondPath(33, 9, 4.5, 3.5, 1.5)}" fill="${C.turquoise}"/>`,
  ),
);

// Suzani medallion (pomegranate petals, leaf ring, dotted borders), warm and night palettes.
function suzani(main: string, accent: string, deep: string) {
  const petal = "M0 -30C17 -38 21 -56 0 -66C-21 -56 -17 -38 0 -30Z";
  const leaf = "M0 -74C6 -79 6 -86 0 -91C-6 -86 -6 -79 0 -74Z";
  let g = "";
  for (let i = 0; i < 16; i++) g += `<path d="${leaf}" fill="${i % 2 ? accent : deep}" transform="rotate(${i * 22.5})" opacity="0.9"/>`;
  for (let i = 0; i < 8; i++) {
    g += `<g transform="rotate(${i * 45 + 22.5})"><path d="${petal}" fill="${main}"/><circle cy="-50" r="4.2" fill="${accent}"/><circle cy="-50" r="1.6" fill="${deep}"/></g>`;
  }
  for (let i = 0; i < 32; i++) g += `<circle cy="-80" r="1.4" fill="${accent}" transform="rotate(${i * 11.25 + 5.6})"/>`;
  return svg(
    200,
    200,
    `<circle cx="100" cy="100" r="96" fill="none" stroke="${deep}" stroke-width="1.2" opacity="0.6"/>` +
      `<circle cx="100" cy="100" r="70" fill="none" stroke="${accent}" stroke-width="1" opacity="0.8"/>` +
      `<g transform="translate(100 100)">${g}</g>` +
      `<path d="${khatamPath(100, 100, 26)}" fill="${deep}"/><path d="${polygonPath(100, 100, 12, 8, 22.5)}" fill="${accent}"/><circle cx="100" cy="100" r="4" fill="${main}"/>`,
  );
}
write("suzani-warm.svg", suzani(C.pomegranate, C.saffron, C.lapis));
write("suzani-night.svg", suzani(C.saffron, C.turquoise, C.ivory));

// Ribbed turquoise dome on a drum, with a crescent finial.
write(
  "dome.svg",
  svg(
    120,
    150,
    `<path d="M60 4v20" stroke="${C.saffron}" stroke-width="2"/><circle cx="60" cy="16" r="3.2" fill="${C.saffron}"/>` +
      `<path d="M55 8.5a5.5 5.5 0 1 0 8.5-4.6a4.4 4.4 0 1 1-8.5 4.6Z" fill="${C.saffron}"/>` +
      `<path d="M22 104C14 66 36 38 60 28C84 38 106 66 98 104Z" fill="${C.turquoise}"/>` +
      `<g fill="none" stroke="${C.lapisDeep}" stroke-opacity="0.35" stroke-width="1.3"><path d="M60 28V104"/><path d="M60 28C48 44 42 70 44 104"/><path d="M60 28C72 44 78 70 76 104"/><path d="M60 28C40 42 28 70 32 104"/><path d="M60 28C80 42 92 70 88 104"/></g>` +
      `<rect x="26" y="102" width="68" height="10" rx="1.5" fill="${C.lapisDeep}"/><rect x="30" y="112" width="60" height="38" fill="${C.sand}"/>` +
      `<path d="M30 120h60M30 128h60" stroke="${C.saffron}" stroke-width="1"/><path d="${archPath(14, 20)}" transform="translate(53 130)" fill="${C.lapisDeep}"/>`,
  ),
);

console.log("Wrote ornament SVGs to public/ornament/");
