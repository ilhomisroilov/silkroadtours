import { getDb, getEnv } from "@/db/client";
import { createLead } from "@/db/queries/leads";
import { insertPartner, recentPartnerApplications } from "@/db/queries/partners";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { runInBackground } from "@/lib/background";
import { hashIp, randomToken } from "@/lib/crypto";
import { ApiError, clientIp, created, notFound, parseBody, route, tooManyRequests } from "@/lib/http";
import { formatService } from "@/lib/partners";
import { tooManySubmissions } from "@/lib/rate-limit";
import { escapeHtml, sendTelegramMessage } from "@/lib/telegram";
import { verifyTurnstile } from "@/lib/turnstile";
import { partnerApplicationSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

/** Applications allowed per client (IP hash) per 10 minutes, on top of the shared form limit. */
const PARTNER_APPLICATION_LIMIT = 3;

/** POST /api/partners — a business applies to join the partner network. Creates a pending profile and a CRM lead. */
export const POST = route(async (req) => {
  const input = await parseBody(req, partnerApplicationSchema);
  const env = getEnv();
  const db = getDb();
  const ip = clientIp(req);

  const captcha = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!captcha.ok) throw new ApiError(400, "captcha_failed");
  const ipHash = await hashIp(ip, env.SESSION_SECRET);
  if ((await tooManySubmissions(db, ipHash)) || (await recentPartnerApplications(db, ipHash)) >= PARTNER_APPLICATION_LIMIT) throw tooManyRequests();
  if (input.destinationSlug && !(await getPublishedDestinationBySlug(db, input.destinationSlug))) throw notFound("destination_not_found");

  const services = input.services.map(formatService);
  const token = randomToken(24);
  const { reference } = await insertPartner(db, {
    token,
    type: input.type,
    status: "pending",
    source: "application",
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    destinationSlug: input.destinationSlug,
    city: input.city,
    description: input.description,
    services,
    locale: input.locale,
    ipHash,
  });

  await createLead(db, {
    source: "partner",
    sourceRef: reference,
    fullName: input.contactName,
    email: input.email,
    phone: input.phone,
    locale: input.locale,
    title: `Partner application: ${input.businessName} (${input.type.replace(/_/g, " ")})`,
    destination: input.destinationSlug ?? input.city,
    interests: services.join(" · ").slice(0, 1000) || null,
  });

  const site = (env.SITE_URL ?? "").replace(/\/$/, "");
  const text = [
    `<b>New partner application</b> ${escapeHtml(reference)}`,
    `<b>Business:</b> ${escapeHtml(input.businessName)} (${escapeHtml(input.type.replace(/_/g, " "))})`,
    `<b>City:</b> ${escapeHtml(input.city)}`,
    `<b>Contact:</b> ${escapeHtml(input.contactName)} · ${escapeHtml(input.phone)} · ${escapeHtml(input.email)}`,
    `<b>Services:</b> ${escapeHtml(services.slice(0, 5).join("; "))}`,
    site ? `${site}/admin/partners?q=${encodeURIComponent(reference)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    await runInBackground(
    sendTelegramMessage({ botToken: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID }, text).then((r) => {
      if (!r.ok) console.error(`[telegram] partner ${reference} not delivered: ${r.error}`);
    }),
    );
  }

  return created({ reference, token, status: "pending" as const });
});
