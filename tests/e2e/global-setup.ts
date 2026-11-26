import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

/**
 * Makes sure a local admin account exists for the admin tests.
 * Uses ADMIN_SECRET from .dev.vars (local test secret) and keeps the password in
 * .smoke-admin.json (git-ignored), the same file the smoke test uses.
 */
export default async function globalSetup() {
  const base = (process.env.E2E_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
  const health = await fetch(`${base}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`The app is not running at ${base}. Start it with: npm run preview`);
  if (existsSync(".smoke-admin.json")) return;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const secret = vars.split("\n").find((l) => l.startsWith("ADMIN_SECRET="))?.slice("ADMIN_SECRET=".length).trim();
  if (!secret) return;
  const creds = { email: "e2e-admin@example.com", name: "E2E Admin", password: randomBytes(18).toString("base64url") };
  const r = await fetch(`${base}/api/admin/auth/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": secret },
    body: JSON.stringify(creds),
  });
  if (r.status === 201) writeFileSync(".smoke-admin.json", JSON.stringify({ email: creds.email, password: creds.password }, null, 2));
}
