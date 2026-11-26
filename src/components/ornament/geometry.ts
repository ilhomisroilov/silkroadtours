// Pure geometry for the ornament library. Every motif is constructed from the
// public-domain principles of Islamic/Central Asian geometric design (star polygons
// on a square or decagonal lattice), not traced from any specific artwork.
// Kept dependency-free so scripts/build-ornaments.ts can reuse it.

const r2 = (n: number) => Math.round(n * 100) / 100;

export function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0° points up
  return [r2(cx + radius * Math.cos(a)), r2(cy + radius * Math.sin(a))];
}

const toPath = (pts: [number, number][], close = true) =>
  `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}${close ? "Z" : ""}`;

/** Outline of an n-pointed star with alternating outer/inner radii. */
export function starPath(cx: number, cy: number, outer: number, inner: number, points: number, rotation = 0): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rotation + (i * 180) / points));
  }
  return toPath(pts);
}

/** The classic 8-point "khatam" star: the union of two squares. Inner radius = R·cos45°/cos22.5°. */
export function khatamPath(cx: number, cy: number, radius: number, rotation = 0): string {
  return starPath(cx, cy, radius, radius * (Math.SQRT1_2 / Math.cos(Math.PI / 8)), 8, rotation);
}

/** Regular polygon outline. */
export function polygonPath(cx: number, cy: number, radius: number, sides: number, rotation = 0): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) pts.push(polar(cx, cy, radius, rotation + (i * 360) / sides));
  return toPath(pts);
}

/** Star polygon {n/k}: n points on a circle joined every k-th point (e.g. {10/3} girih rosette). */
export function starPolygonPath(cx: number, cy: number, radius: number, n: number, k: number, rotation = 0): string {
  const visited = new Set<number>();
  const parts: string[] = [];
  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue;
    const pts: [number, number][] = [];
    let i = start;
    do {
      visited.add(i);
      pts.push(polar(cx, cy, radius, rotation + (i * 360) / n));
      i = (i + k) % n;
    } while (i !== start);
    parts.push(toPath(pts));
  }
  return parts.join("");
}

/**
 * Ikat diamond: a diamond whose edges are drawn as small steps with a slight,
 * deterministic jitter — the "feathered" edge of resist-dyed adras/atlas silk.
 */
export function ikatDiamondPath(cx: number, cy: number, rx: number, ry: number, step = 3): string {
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  let k = 0;
  for (let x = cx - rx; x < cx + rx; x += step, k++) {
    const mid = x + step / 2;
    const h = Math.max(0, ry * (1 - Math.abs(mid - cx) / rx));
    const jitter = k % 3 === 0 ? 0.9 : k % 3 === 1 ? -0.6 : 0.2;
    const hTop = Math.max(0.5, h + jitter);
    const hBottom = Math.max(0.5, h - jitter * 0.7);
    top.push([r2(x), r2(cy - hTop)], [r2(x + step), r2(cy - hTop)]);
    bottom.push([r2(x), r2(cy + hBottom)], [r2(x + step), r2(cy + hBottom)]);
  }
  return toPath([[cx - rx, cy], ...top, [cx + rx, cy], ...bottom.reverse()]);
}

/** Pointed (iwan/peshtaq) arch outline inside a w×h box; `spring` = height where the curve starts. */
export function archPath(w: number, h: number, spring = 0.37): string {
  const s = r2(h * spring);
  const c = r2(h * spring * 0.46);
  return `M0 ${h}V${s}C0 ${c} ${r2(w * 0.22)} ${r2(h * 0.065)} ${r2(w / 2)} 0C${r2(w * 0.78)} ${r2(h * 0.065)} ${w} ${c} ${w} ${s}V${h}Z`;
}

// ── Seamless tiles (used for CSS backgrounds and <pattern> fills) ───────────

/** Square girih tile: 8-point stars on a centred-square lattice, with octagon rosettes and diamond nodes. */
export function girihTile(size: number): string {
  const R = size * 0.3465;
  const parts: string[] = [];
  const centres: [number, number][] = [
    [0, 0],
    [size, 0],
    [0, size],
    [size, size],
    [size / 2, size / 2],
  ];
  for (const [x, y] of centres) {
    parts.push(khatamPath(x, y, R));
    parts.push(khatamPath(x, y, R - size * 0.03));
    parts.push(polygonPath(x, y, R * 0.42, 8, 22.5));
  }
  // Four-point nodes where the star tips meet (edge midpoints of the tile).
  const node = size * 0.07;
  for (const [x, y] of [
    [size / 2, 0],
    [size / 2, size],
    [0, size / 2],
    [size, size / 2],
  ] as [number, number][]) {
    parts.push(starPath(x, y, node, node * 0.38, 4, 45));
  }
  return parts.join("");
}

export interface IslimiPaths {
  stem: string;
  leaves: string;
  buds: { cx: number; cy: number; r: number }[];
}

/** One 120×32 repeat of a flowing islimi (vine-scroll) border: wave stem, spiral tendrils, split leaves. */
export function islimiRepeat(): IslimiPaths {
  return {
    stem: [
      "M0 16C15 6 45 6 60 16C75 26 105 26 120 16",
      "M30 8.6C33 2.5 43 1.8 44.5 7.4C45.6 11.6 40.6 13.6 38.2 10.6C36.6 8.6 38.8 6.6 40.6 7.8",
      "M90 23.4C87 29.5 77 30.2 75.5 24.6C74.4 20.4 79.4 18.4 81.8 21.4C83.4 23.4 81.2 25.4 79.4 24.2",
    ].join(""),
    leaves: [
      "M60 16C63 9.5 69 6.2 77 4.6C72.6 9.8 67.8 13.6 60 16Z",
      "M60 16C57 22.5 51 25.8 43 27.4C47.4 22.2 52.2 18.4 60 16Z",
      "M0 16C3 22.6 9 25.6 16.5 27C12.5 22 8 18.4 0 16Z",
      "M120 16C117 9.4 111 6.4 103.5 5C107.5 10 112 13.6 120 16Z",
    ].join(""),
    buds: [
      { cx: 18, cy: 10.2, r: 1.5 },
      { cx: 102, cy: 21.8, r: 1.5 },
    ],
  };
}
