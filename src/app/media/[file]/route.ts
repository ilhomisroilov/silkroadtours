import { mediaMime, readUpload } from "@/lib/server/media";

export const dynamic = "force-dynamic";

/** Serves admin-uploaded images from the data volume. Only server-generated file names are accepted. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const mime = mediaMime(file);
  const buf = mime ? await readUpload(file) : null;
  if (!buf || !mime) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
