import type { NextRequest } from "next/server";
import { ACCOUNTS_API_URL } from "@/lib/server/account";
import { clientIp } from "@/lib/http";

/**
 * Same-origin gateway to the accounts service: /v1/* on the site is forwarded to the Python API on the private
 * network, so the sign-in cookie belongs to the site's own domain (nationaltours.uz today, gulistantravel.uz later)
 * with no extra DNS or nginx change.
 */
export const dynamic = "force-dynamic";

const PASS_REQ = ["content-type", "cookie", "origin", "referer", "user-agent", "accept", "accept-language", "idempotency-key", "x-booking-token"];
const PASS_RES = ["content-type", "location", "cache-control", "retry-after"];

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!ACCOUNTS_API_URL) return Response.json({ detail: { code: "service_unavailable" } }, { status: 503 });
  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p.includes("/"))) return Response.json({ detail: { code: "not_found" } }, { status: 404 });
  const url = `${ACCOUNTS_API_URL}/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const h of PASS_REQ) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("x-forwarded-for", clientIp(req));
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));
  headers.set("x-forwarded-host", req.headers.get("host") ?? "");
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return Response.json({ detail: { code: "service_unavailable" } }, { status: 503 });
  }
  const out = new Headers({ "cache-control": "no-store" });
  for (const h of PASS_RES) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
