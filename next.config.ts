import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Lists the photos that really exist under public/images when the app is built or `next dev` starts.
 * Components show a branded ornament fallback for any /images/... path not in this list,
 * so a missing photo never causes a broken image or a 404 request.
 * After adding photos, restart `npm run dev` or rebuild.
 */
function listPublicImages(): string[] {
  const root = join(process.cwd(), "public");
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(name)) out.push("/" + relative(root, full).split(sep).join("/"));
    }
  };
  walk(join(root, "images"));
  return out.sort();
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // The Workers runtime has no built-in Next image optimizer. Media is served
    // from /public or absolute URLs (R2 / Cloudflare Images / CDN) that are already sized.
    unoptimized: true,
  },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_IMAGE_MANIFEST: JSON.stringify(listPublicImages()),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/ornament/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default withNextIntl(nextConfig);

