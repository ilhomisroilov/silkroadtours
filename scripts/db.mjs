#!/usr/bin/env node
/**
 * Database operations for the Docker / Node deployment (no dev dependencies needed).
 *
 *   node scripts/db.mjs migrate          apply drizzle/migrations/*.sql not yet applied
 *   node scripts/db.mjs seed             load drizzle/seed.sql if the catalog is empty
 *   node scripts/db.mjs seed --force     load drizzle/seed.sql even if tours exist
 *   node scripts/db.mjs seed --reset     replace the catalogue (destinations, tours, FAQ, content); bookings are kept
 *   node scripts/db.mjs status           list applied migrations and row counts
 *   node scripts/db.mjs backup           consistent copy to $BACKUP_DIR (default /data/backups), keeps $BACKUP_KEEP (14)
 *   node scripts/db.mjs prune            delete AI conversations older than the retention set in admin (default 90 days)
 *
 * DATABASE_URL defaults to file:./data/silkroad.db (Docker: file:/data/silkroad.db).
 */
import { createClient } from "@libsql/client";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL || "file:./data/silkroad.db";
if (url.startsWith("file:")) {
  const path = url.slice(5);
  mkdirSync(dirname(path.startsWith("/") ? path : join(process.cwd(), path)), { recursive: true });
}
const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const [cmd = "migrate", ...flags] = process.argv.slice(2);

async function migrate() {
  await db.execute("PRAGMA journal_mode=WAL");
  await db.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))",
  );
  const done = new Set((await db.execute("SELECT name FROM _migrations")).rows.map((r) => String(r.name)));
  const dir = join(ROOT, "drizzle", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let n = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), "utf8");
    await db.executeMultiple(`BEGIN;\n${sql}\nINSERT INTO _migrations (name) VALUES ('${f}');\nCOMMIT;`);
    console.log(`applied ${f}`);
    n++;
  }
  console.log(n ? `${n} migration(s) applied` : "database is up to date");
}

async function seed() {
  const reset = flags.includes("--reset");
  const file = join(ROOT, "drizzle", reset ? "seed-reset.sql" : "seed.sql");
  if (!existsSync(file)) throw new Error(`${file} not found (run npm run db:seed:build)`);
  const [{ n }] = (await db.execute("SELECT count(*) AS n FROM tours")).rows;
  if (Number(n) > 0 && !flags.includes("--force") && !reset) {
    console.log(`catalog already has ${n} tours — seed skipped (use --force)`);
    return;
  }
  await db.executeMultiple(`BEGIN;\n${readFileSync(file, "utf8")}\nCOMMIT;`);
  console.log("seed loaded");
}

async function status() {
  const rows = (await db.execute("SELECT name, applied_at FROM _migrations ORDER BY name")).rows;
  for (const r of rows) console.log(`${r.name}  ${new Date(Number(r.applied_at) * 1000).toISOString()}`);
  for (const t of ["tours", "destinations", "bookings", "reviews", "faq_items", "ai_conversations"]) {
    try {
      const [{ n }] = (await db.execute(`SELECT count(*) AS n FROM ${t}`)).rows;
      console.log(`${t}: ${n}`);
    } catch {
      /* table may not exist yet */
    }
  }
}

async function backup() {
  const dir = process.env.BACKUP_DIR || "/data/backups";
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `silkroad-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await db.execute(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 14));
  const files = readdirSync(dir).filter((f) => /^silkroad-.*\.db$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) unlinkSync(join(dir, f));
  console.log(`backup written: ${file}`);
}

async function prune() {
  const row = (await db.execute("SELECT value FROM settings WHERE key = 'ai'")).rows[0];
  let days = 90;
  try {
    days = Number(JSON.parse(String(row?.value ?? "{}")).retentionDays) || 90;
  } catch {
    /* keep default */
  }
  const r = await db.execute({ sql: "DELETE FROM ai_conversations WHERE updated_at < unixepoch() - ? * 86400", args: [days] });
  await db.execute({ sql: "DELETE FROM saved_trip_plans WHERE created_at < unixepoch() - ? * 86400 AND conversation_id IS NULL", args: [days * 4] }).catch(() => {});
  console.log(`pruned ${r.rowsAffected} AI conversation(s) older than ${days} days`);
}

const ops = { migrate, seed, status, backup, prune };
if (!ops[cmd]) {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}
ops[cmd]()
  .then(() => db.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
