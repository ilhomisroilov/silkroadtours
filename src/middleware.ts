import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale routing for the customer site: "/" → "/en" (or the visitor's language), "/tours" → "/en/tours".
export default createMiddleware(routing);

export const config = {
  // Skip the API, the admin panel, Next internals and any file with an extension (images, robots.txt, sitemap.xml).
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
