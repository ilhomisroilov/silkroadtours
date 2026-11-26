import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, z } from "zod";
import { PricingError } from "./pricing";

/**
 * Every API response is either { data } or { error: { code, message?, fields? } }.
 * `code` values are stable identifiers the UI maps to translated messages (messages/*.json → "errors").
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;
  constructor(status: number, code: string, message?: string, fields?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (code = "bad_request", message?: string) => new ApiError(400, code, message);
export const unauthorized = () => new ApiError(401, "unauthorized");
export const forbidden = (code = "forbidden") => new ApiError(403, code);
export const notFound = (code = "not_found") => new ApiError(404, code);
export const conflict = (code: string, message?: string) => new ApiError(409, code, message);
export const unprocessable = (code: string, message?: string) => new ApiError(422, code, message);
export const tooManyRequests = (code = "rate_limited") => new ApiError(429, code);

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function zodFieldErrors(err: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message !== err.code ? err.message : undefined, fields: err.fields } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_failed", fields: zodFieldErrors(err) } },
      { status: 400 },
    );
  }
  if (err instanceof PricingError) {
    console.error("[pricing]", err.code, err.message);
    return NextResponse.json({ error: { code: `pricing_${err.code}` } }, { status: 500 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { code: "internal_error" } }, { status: 500 });
}

type RouteContext<P> = { params: Promise<P> };

/** Wraps a route handler with uniform error handling and resolved params. */
export function route<P extends Record<string, string> = Record<string, never>>(
  handler: (req: NextRequest, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    try {
      return await handler(req, await ctx.params);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

const MAX_BODY_BYTES = 64 * 1024;

/** Reads and validates a JSON body (max 64 KB). */
export async function parseBody<T extends ZodType>(req: NextRequest, schema: T): Promise<z.output<T>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw badRequest("expected_json");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw badRequest("invalid_json");
  }
  return schema.parse(json);
}

/** Validates URL search params (repeated keys are not supported; last value wins). */
export function parseQuery<T extends ZodType>(req: NextRequest, schema: T): z.output<T> {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value !== "") obj[key] = value;
  });
  return schema.parse(obj);
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}

export function clientIp(req: NextRequest): string {
  // nginx (deploy/nginx) overwrites X-Real-IP with the TCP peer address, so it cannot be spoofed by the client.
  // CF-Connecting-IP is trusted only when the site is explicitly behind Cloudflare.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  if (process.env.TRUST_CF_CONNECTING_IP === "true") {
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
  }
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.at(-1) ?? "0.0.0.0";
}

/** CSRF defence for cookie-authenticated mutations: the Origin must match this site. */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  if (!origin) throw forbidden("missing_origin");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("bad_origin");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  if (originHost !== host) throw forbidden("bad_origin");
}

/** Recognises SQLite/D1 unique-constraint failures (drizzle wraps the driver error in `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const msg = cur instanceof Error ? cur.message : String(cur);
    if (msg.includes("UNIQUE constraint failed")) return true;
    cur = cur instanceof Error ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export function isForeignKeyViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const msg = cur instanceof Error ? cur.message : String(cur);
    if (msg.includes("FOREIGN KEY constraint failed")) return true;
    cur = cur instanceof Error ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}
