import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/*/book/", "/*/booking/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
