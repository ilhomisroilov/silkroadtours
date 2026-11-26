import { inArray } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { createLead } from "@/db/queries/leads";
import { getPublishedPlace } from "@/db/queries/places";
import { getPublishedContent } from "@/db/queries/content";
import { getPublishedDestinationBySlug } from "@/db/queries/destinations";
import { insertServiceRequest } from "@/db/queries/service-requests";
import { getContact } from "@/db/queries/settings";
import { destinations } from "@/db/schema";
import { runInBackground } from "@/lib/background";
import { hashIp } from "@/lib/crypto";
import { ApiError, clientIp, created, notFound, parseBody, route, tooManyRequests } from "@/lib/http";
import { notifyServiceRequest } from "@/lib/notify";
import { tooManySubmissions } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { serviceRequestSchema } from "@/validators/service-request";

/** Always run per request: these handlers read D1 via the Cloudflare context. */
export const dynamic = "force-dynamic";

/** POST /api/service-requests — airport transfer, tailor-made tour, hotel/yurt reservation, guide hire. */
export const POST = route(async (req) => {
  const input = await parseBody(req, serviceRequestSchema);
  const env = getEnv();
  const db = getDb();
  const ip = clientIp(req);

  const captcha = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!captcha.ok) throw new ApiError(400, "captcha_failed");
  const ipHash = await hashIp(ip, env.SESSION_SECRET);
  if (await tooManySubmissions(db, ipHash)) throw tooManyRequests();

  if (input.type === "accommodation" || input.type === "guide") {
    if (!(await getPublishedDestinationBySlug(db, input.destinationSlug))) throw notFound("destination_not_found");
  }
  if (input.type === "inquiry" && input.refSlug && (input.topic === "experience" || input.topic === "service")) {
    if (!(await getPublishedContent(db, input.topic, input.refSlug))) throw notFound("not_found");
  }
  if (input.type === "inquiry" && input.refSlug && (input.topic === "hotel" || input.topic === "restaurant" || input.topic === "transport")) {
    if (!(await getPublishedPlace(db, input.topic, input.refSlug))) throw notFound("not_found");
  }
  if (input.type === "custom_tour") {
    const found = await db
      .select({ slug: destinations.slug })
      .from(destinations)
      .where(inArray(destinations.slug, input.destinationSlugs));
    if (found.length !== new Set(input.destinationSlugs).size) throw notFound("destination_not_found");
  }

  const { fullName, email, phone, contactChannel, messengerHandle, locale, turnstileToken: _t, ...details } = input;
  const payload = details as Record<string, unknown>;
  const { id, reference } = await insertServiceRequest(db, {
    type: input.type,
    fullName,
    email,
    phone,
    contactChannel,
    messengerHandle: messengerHandle ?? null,
    locale,
    payload,
    ipHash,
  });

  const p = payload as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  await createLead(db, {
    source: input.type === "custom_tour" && p.tripId ? "trip" : "request",
    sourceRef: reference,
    fullName,
    email,
    phone,
    locale,
    title: str(p.subject) ?? input.type.replace(/_/g, " "),
    destination: str(p.destinationSlug) ?? (Array.isArray(p.destinationSlugs) ? (p.destinationSlugs as string[]).join(", ") : null),
    interests: [Array.isArray(p.interests) ? (p.interests as string[]).join(", ") : null, str(p.notes)].filter(Boolean).join(" · ").slice(0, 1000) || null,
    budgetUsd: typeof p.budgetPerPersonUsd === "number" ? p.budgetPerPersonUsd : typeof p.budgetUsd === "number" ? p.budgetUsd : null,
    travelFrom: str(p.startDate) ?? str(p.checkIn) ?? str(p.date),
    travelTo: str(p.endDate) ?? str(p.checkOut),
    travellers:
      typeof p.adults === "number" ? p.adults + (typeof p.children === "number" ? p.children : 0) : typeof p.guests === "number" ? p.guests : typeof p.groupSize === "number" ? p.groupSize : typeof p.passengers === "number" ? p.passengers : null,
  });

  await runInBackground(
    notifyServiceRequest(db, env, {
      id,
      reference,
      type: input.type,
      fullName,
      email,
      phone,
      contactChannel,
      messengerHandle,
      locale,
      payload,
    }),
  );

  const contact = await getContact(db);
  return created({
    reference,
    status: "pending" as const,
    followUp: { whatsapp: contact.whatsapp, telegram: contact.telegram, phone: contact.phone },
  });
});
