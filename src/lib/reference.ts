// Public reference IDs: "UZ-2026-48392" for bookings, "SR-2026-20417" for service requests.
// 5 random digits (90,000 per prefix per year); inserts retry on the unique index.

export type ReferencePrefix = "UZ" | "SR";

const REFERENCE_RE = /^(UZ|SR)-(\d{4})-(\d{5})$/;

/** Unbiased integer in [min, max] using the Web Crypto API (available in Workers and Node ≥ 19). */
export function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return min + (x % range);
}

export function generateReference(prefix: ReferencePrefix, now: Date = new Date()): string {
  // Year in Uzbekistan time (UTC+5) so a booking at 00:30 local on 1 Jan gets the new year.
  const year = new Date(now.getTime() + 5 * 3600_000).getUTCFullYear();
  return `${prefix}-${year}-${secureRandomInt(10000, 99999)}`;
}

export function isValidReference(value: string): boolean {
  return REFERENCE_RE.test(value);
}

/**
 * Runs `insert` with fresh references until it succeeds or a non-collision error occurs.
 * `isUniqueViolation` lets callers recognise the D1 "UNIQUE constraint failed" error.
 */
export async function withUniqueReference<T>(
  prefix: ReferencePrefix,
  insert: (reference: string) => Promise<T>,
  isUniqueViolation: (err: unknown) => boolean,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await insert(generateReference(prefix));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
