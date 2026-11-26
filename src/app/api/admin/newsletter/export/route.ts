import { getDb } from "@/db/client";
import { listSubscribers } from "@/db/queries/content";
import { requireAdmin } from "@/lib/auth/guard";
import { route } from "@/lib/http";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : v);

/** CSV of newsletter subscribers (email, language, source, date); formula-looking cells are neutralised. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const rows = await listSubscribers(getDb(), 100_000);
  const lines = ["email,locale,source,subscribed_at", ...rows.map((r) => [r.email, r.locale, r.source ?? "", r.createdAt.toISOString()].map(cell).join(","))];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
