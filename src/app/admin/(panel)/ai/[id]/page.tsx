import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ai/rich-text";
import { stamp, StatusPill } from "@/components/admin/ai-center/sections";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { conversationDetail } from "@/lib/ai/admin";
import { cn } from "@/lib/cn";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("aicenter.detail.title") };
}

export default async function AdminAiConversation({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { t } = await adminT();
  const d = await conversationDetail(getDb(), id);
  if (!d) notFound();
  const rating = new Map(d.ratings.map((r) => [r.messageId, r.rating]));
  return (
    <>
      <p className="mb-2">
        <Link href="/admin/ai?tab=logs" className="inline-flex min-h-11 items-center text-sm font-semibold text-cobalt underline">← {t("aicenter.detail.back")}</Link>
      </p>
      <PageHeader title={t("aicenter.detail.title")}>
        <p className="mt-1 break-words text-sm text-ink-muted">
          <span className="font-mono">{d.conv.id}</span> · {d.conv.locale.toUpperCase()} · {d.isTest ? t("aicenter.logs.test") : t(`aicenter.logs.sources.${d.conv.source}`)} · {stamp(d.conv.createdAt)}
          {!d.isTest && d.conv.page ? ` · ${t("aicenter.detail.page")}: ${d.conv.page}` : ""}
          {d.conv.bookingReference ? ` · ${d.conv.bookingReference}` : ""}
        </p>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={t("aicenter.detail.messages")} className="xl:col-span-2">
          <ol className="space-y-3">
            {d.messages.map((m) => (
              <li key={m.id} className={cn("rounded-sm border p-3 text-sm", m.role === "user" ? "border-lapis-deep/20 bg-sand-soft" : "border-line bg-white")}>
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                  <span className="font-bold uppercase tracking-wider">{m.role === "user" ? t("aicenter.detail.visitor") : t("aicenter.detail.assistant")}</span>
                  <span>{stamp(m.createdAt).slice(11)}</span>
                  {m.role === "assistant" && (
                    <>
                      <span>· {m.provider ? `${m.provider} ${m.model ?? ""}` : t("aicenter.detail.catalogue")}</span>
                      <span>· {t("aicenter.seconds", { s: ((m.latencyMs ?? 0) / 1000).toFixed(1) })}</span>
                      <span>· {t("aicenter.detail.tokens", { in: m.tokensIn ?? 0, out: m.tokensOut ?? 0 })}</span>
                      <StatusPill status={m.status} t={t} />
                      {rating.has(m.id) && <span className={cn("font-semibold", rating.get(m.id)! > 0 ? "text-success" : "text-danger")}>{rating.get(m.id)! > 0 ? t("aicenter.logs.ratedUp") : t("aicenter.logs.ratedDown")}</span>}
                    </>
                  )}
                </div>
                {m.role === "assistant" ? <div className="leading-relaxed"><RichText text={m.content} /></div> : <p className="whitespace-pre-wrap">{m.content}</p>}
                {m.error && <p className="mt-2 break-words rounded-sm bg-danger/5 px-2 py-1 font-mono text-xs text-danger">{m.error}</p>}
                {m.sources.length > 0 && <p className="mt-2 text-xs text-ink-muted">{t("aicenter.detail.sources")}: {m.sources.join(", ")}</p>}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={t("aicenter.detail.toolLogs")}>
          {d.toolLogs.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("aicenter.detail.noTools")}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {d.toolLogs.map((l) => (
                <li key={l.id} className="border-b border-line pb-2">
                  <code className={cn("font-mono font-bold", l.ok ? "text-lapis-deep" : "text-danger")}>{l.tool}</code>
                  <span className="text-ink-muted"> · {t("aicenter.detail.results", { count: l.resultCount ?? 0 })}</span>
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
