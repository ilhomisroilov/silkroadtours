// Runtime configuration read from process.env on the server (see .env.example).
interface AppEnv {
  SITE_URL: string;
  DEFAULT_CURRENCY: "USD" | "UZS" | "EUR";
  BOOKING_REF_PREFIX: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  /** 32+ random bytes, base64. Signs admin session cookies. */
  SESSION_SECRET: string;
  /** One-time secret that authorises creation of the first owner account. */
  ADMIN_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_FALLBACK_PROVIDER?: string;
  AI_FALLBACK_MODEL?: string;
  AI_SECONDARY_MODEL?: string;
  TRUST_CF_CONNECTING_IP?: string;
  DATABASE_URL?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}
/** Backwards-compatible alias for code written for Cloudflare. */
type CloudflareEnv = AppEnv;
