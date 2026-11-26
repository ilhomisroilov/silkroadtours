import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/lib/auth/guard";
import { assertSameOrigin, badRequest, created, ok, route, unprocessable } from "@/lib/http";
import { logAdminAction } from "@/lib/server/audit";
import { listMediaLibrary, MEDIA_MAX_BYTES, saveUpload } from "@/lib/server/media";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok(await listMediaLibrary());
});

export const POST = route(async (req: NextRequest) => {
  assertSameOrigin(req);
  const admin = await requireAdmin(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw badRequest("file_required");
  if (file.size > MEDIA_MAX_BYTES) throw unprocessable("too_large");
  try {
    const saved = await saveUpload(Buffer.from(await file.arrayBuffer()), file.name);
    await logAdminAction(getDb(), admin, "upload", "media", saved.name);
    return created(saved);
  } catch (e) {
    throw unprocessable((e as Error).message === "too_large" ? "too_large" : "unsupported_type");
  }
});
