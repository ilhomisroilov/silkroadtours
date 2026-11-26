import type { MetadataRoute } from "next";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPublishedTours } from "@/db/queries/tours";
import { LOCALES } from "@/db/types";
import { db, exchangeRates, siteUrl } from "@/lib/server/site";
import { SERVICE_SLUGS } from "@/components/services/service-cards";

export const dynamic = "force-dynamic";

/** Every public page in en/uz/ru with hreflang alternates. Built from the live catalogue. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const rates = await exchangeRates();
  const [destinations, tours] = await Promise.all([
    listPublishedDestinations(db()),
    listPublishedTours(db(), { sort: "featured", currency: "USD", page: 1, pageSize: 48 }, rates),
  ]);
  const paths = [
    "",
    "/tours",
    "/destinations",
    "/inbound",
    "/domestic",
    "/services",
    ...SERVICE_SLUGS.map((s) => `/services/${s}`),
    "/travel-guide",
    "/about",
    "/contact",
    ...destinations.map((d) => `/destinations/${d.slug}`),
    ...tours.items.map((t) => `/tours/${t.slug}`),
  ];
  return paths.flatMap((p) =>
    LOCALES.map((l) => ({
      url: `${base}/${l}${p}`,
      changeFrequency: p.startsWith("/tours/") ? ("weekly" as const) : ("monthly" as const),
      priority: p === "" ? 1 : p.split("/").length > 2 ? 0.7 : 0.8,
      alternates: { languages: Object.fromEntries([...LOCALES.map((x) => [x, `${base}/${x}${p}`]), ["x-default", `${base}/en${p}`]]) },
    })),
  );
}
