import { defineConfig } from "drizzle-kit";

// `drizzle-kit is used only for `studio`; migrations are hand-written SQL (see docs/MANUAL_SETUP.md §10).
// `drizzle-kit studio` against the remote D1 uses the d1-http driver and the
// three CLOUDFLARE_* values from .env.
const hasRemoteCreds =
  !!process.env.CLOUDFLARE_ACCOUNT_ID &&
  !!process.env.CLOUDFLARE_D1_DATABASE_ID &&
  !!process.env.CLOUDFLARE_API_TOKEN;

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  strict: true,
  verbose: true,
  ...(hasRemoteCreds
    ? {
        driver: "d1-http" as const,
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
          databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
          token: process.env.CLOUDFLARE_API_TOKEN!,
        },
      }
    : {}),
});
