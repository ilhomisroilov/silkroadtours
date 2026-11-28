import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// Locale routing for the customer site: "/" → "/en" (or the visitor's language), "/tours" → "/en/tours".
// Search engines may index the site; set SEARCH_INDEXING=off in .env to keep it out of search results.
export default function middleware(req: NextRequest) {
  const res = intl(req);
  if (process.env.SEARCH_INDEXING === "off") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Skip the API, the admin panel, Next internals and any file with an extension (images, robots.txt, sitemap.xml).
  matcher: ["/((?!api|v1|admin|_next|_vercel|.*\\..*).*)"],
};
