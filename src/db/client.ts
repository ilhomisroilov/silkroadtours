import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite (libSQL) database. The schema, migrations and queries are the same SQLite dialect the
 * project used on Cloudflare D1, so business logic is unchanged. In Docker the file lives on the
 * persistent `data` volume (DATABASE_URL=file:/data/silkroad.db).
 */
export type Db = LibSQLDatabase<typeof schema>;

const g = globalThis as unknown as { __srtDb?: Db; __srtClient?: Client };

export function getClient(): Client {
  if (!g.__srtClient) {
    const url = process.env.DATABASE_URL || "file:./data/silkroad.db";
    g.__srtClient = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
    // WAL keeps reads fast while a write is in progress; busy_timeout avoids SQLITE_BUSY under load.
    if (url.startsWith("file:")) {
      void g.__srtClient.execute("PRAGMA journal_mode=WAL").catch(() => {});
      void g.__srtClient.execute("PRAGMA busy_timeout=5000").catch(() => {});
      void g.__srtClient.execute("PRAGMA foreign_keys=ON").catch(() => {});
    }
  }
  return g.__srtClient;
}

export function getDb(): Db {
  if (!g.__srtDb) g.__srtDb = drizzle(getClient(), { schema });
  return g.__srtDb;
}

/** Kept for call sites written for static generation. */
export async function getDbAsync(): Promise<Db> {
  return getDb();
}

export function getEnv(): AppEnv {
  return process.env as unknown as AppEnv;
}
