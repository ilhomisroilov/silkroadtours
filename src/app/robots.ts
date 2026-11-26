import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  // Before launch (SEARCH_INDEXING not "on") pages also send "noindex"; no sitemap is advertised.
  if (process.env.SEARCH_INDEXING !== "on") return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/*/book/", "/*/booking/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
