// Small, dependency-free formatters shared by server and client components.

/** "12 Apr 2027" style label from an ISO date, using translated short month names. */
export function formatDateLabel(iso: string, monthsShort: (m: number) => string, withYear = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return withYear ? `${d} ${monthsShort(m)} ${y}` : `${d} ${monthsShort(m)}`;
}

/** Collapses a list of months (1–12) into readable ranges, e.g. [4,5,6,9,10] → "Apr–Jun, Sep–Oct". */
export function monthRanges(months: number[], monthsShort: (m: number) => string): string {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === 12) return "";
  const ranges: [number, number][] = [];
  for (const m of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else ranges.push([m, m]);
  }
  // Join a December run with a January run (winter seasons).
  if (ranges.length > 1 && ranges[0]![0] === 1 && ranges[ranges.length - 1]![1] === 12) {
    const first = ranges.shift()!;
    ranges[ranges.length - 1]![1] = first[1];
  }
  return ranges.map(([a, b]) => (a === b ? monthsShort(a) : `${monthsShort(a)}–${monthsShort(b)}`)).join(", ");
}

/** Builds a query string from defined, non-empty values only. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
