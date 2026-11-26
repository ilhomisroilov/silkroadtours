// Which local photos exist is decided at build time (next.config.ts lists public/images/**).

let manifest: Set<string> | null = null;

function getManifest(): Set<string> {
  if (!manifest) {
    try {
      manifest = new Set<string>(JSON.parse(process.env.NEXT_PUBLIC_IMAGE_MANIFEST ?? "[]") as string[]);
    } catch {
      manifest = new Set();
    }
  }
  return manifest;
}

/** True for absolute https URLs (R2/CDN) and for /images/... files that were present at build time. */
export function imageExists(src: string | null | undefined, known: Set<string> = getManifest()): boolean {
  if (!src) return false;
  if (/^https:\/\/\S+$/.test(src)) return true;
  if (!src.startsWith("/")) return false;
  return known.has(src.split(/[?#]/)[0]!);
}
