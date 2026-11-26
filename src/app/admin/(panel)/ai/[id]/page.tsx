import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { conversationDetail } from "@/lib/ai/admin";
import { AI_ADMIN } from "@/lib/ai/admin-strings";
import { adminLocale, requireAdminPage } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminAiConversation({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const t = AI_ADMIN[await adminLocale()];
  const d = await conversationDetail(getDb(), id);
  if (!d) notFound();
  return (
    <>
      <Link href="/admin/ai" className="text-sm font-semibold text-lapis underline">{t.back}</Link>
      <PageHeader title={`${t.conversations} · ${d.conv.id}`}>
        <p className="mt-1 text-ink-muted">
          {d.conv.locale.toUpperCase()} · {d.conv.source} · {t.page}: {d.conv.page ?? "—"} · {d.conv.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          {d.conv.bookingReference ? ` · ${d.conv.bookingReference}` : ""}
        </p>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={t.messages} className="xl:col-span-2">
          <ol className="space-y-3">
            {d.messages.map((m) => (
              <li key={m.id} className={`rounded-sm border p-3 text-sm ${m.role === "user" ? "border-lapis-deep/20 bg-sand-soft" : "border-line bg-white"}`}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {m.role} · {m.createdAt.toISOString().slice(11, 19)}
                  {m.role === "assistant" && ` · ${m.provider ?? "db"} ${m.model ?? ""} · ${m.status} · ${m.tokensIn ?? 0}/${m.tokensOut ?? 0} tok · ${m.latencyMs ?? 0} ms`}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.error && <p className="mt-1 text-xs text-danger">{m.error}</p>}
                {m.sources.length > 0 && <p className="mt-2 text-xs text-ink-muted">{t.sources}: {m.sources.join(", ")}</p>}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={t.toolLogs}>
          {d.toolLogs.length === 0 ? (
            <p className="text-ink-muted">{t.noData}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {d.toolLogs.map((l) => (
                <li key={l.id} className="border-b border-line pb-2">
                  <b className={l.ok ? "" : "text-danger"}>{l.tool}</b> · {l.resultCount ?? 0}
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[0.7rem] text-ink-muted">{l.input}</pre>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
