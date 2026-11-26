import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart, HBars, Panel, StatTile, tableCls } from "@/components/admin/ui";
import type { aiStats, failedRequests, knowledgeStats, ProviderStatus, recentConversations, usageStats } from "@/lib/ai/admin";
import type { AiSettings } from "@/lib/ai/agent";
import type { adminT } from "@/lib/server/admin";
import { cn } from "@/lib/cn";

type T = Awaited<ReturnType<typeof adminT>>["t"];
type Fmt = (n: number) => string;

export const STATUS_CLS: Record<string, string> = {
  ok: "bg-turquoise-ink/10 text-turquoise-ink",
  unanswered: "bg-saffron-soft text-saffron-ink",
  fallback: "bg-terracotta/10 text-terracotta-deep",
  error: "bg-danger/10 text-danger",
};

export function StatusPill({ status, t }: { status: string | null; t: T }) {
  if (!status) return <span className="text-ink-muted">—</span>;
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_CLS[status] ?? "bg-sand text-ink")}>{t.has(`aicenter.status.${status}`) ? t(`aicenter.status.${status}`) : status}</span>;
}

export const stamp = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
const seconds = (ms: number) => (ms / 1000).toFixed(1);

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-sm border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">{children}</p>;
}

// ── Overview ───────────────────────────────────────────────────────────────

export function KpiTiles({ stats, t, fmt }: { stats: Awaited<ReturnType<typeof aiStats>>; t: T; fmt: Fmt }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label={t("aicenter.kpi.conversations")} value={fmt(stats.conversations)} hint={t("aicenter.kpi.bookingHandoffs", { count: stats.bookingInquiries })} />
      <StatTile label={t("aicenter.kpi.replies")} value={fmt(stats.replies)} hint={t("aicenter.kpi.repliesHint", { ok: stats.ok, fallback: stats.fallback, errors: stats.errors })} />
      <StatTile label={t("aicenter.kpi.latency")} value={stats.replies ? t("aicenter.seconds", { s: seconds(stats.avgLatencyMs) }) : "—"} hint={t("aicenter.kpi.tokens", { in: fmt(stats.tokensIn), out: fmt(stats.tokensOut) })} />
      <StatTile label={t("aicenter.kpi.ratings")} value={`${fmt(stats.feedback.up)} / ${fmt(stats.feedback.down)}`} hint={t("aicenter.kpi.ratingsHint")} />
    </div>
  );
}

export function ProviderPanel({ prov, settings, t, className }: { prov: ProviderStatus; settings: AiSettings; t: T; className?: string }) {
  return (
    <Panel title={t("aicenter.provider.title")} className={cn("min-w-0", className)}>
      {!settings.enabled && <p className="mb-3 rounded-sm border-l-2 border-terracotta bg-terracotta/5 p-3 text-sm">{t("aicenter.provider.disabled")}</p>}
      {prov.chain.length === 0 ? (
        <p className="rounded-sm border-l-2 border-danger bg-danger/5 p-3 text-sm text-danger">{t("aicenter.provider.noProvider")}</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-muted">{t("aicenter.provider.chain")}</p>
          <ol className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {prov.chain.map((p, i) => (
              <li key={p.id + p.model} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-ink-muted">→</span>}
                <span className={cn("inline-flex flex-wrap items-center gap-1.5 rounded-sm border px-2.5 py-1.5", i === 0 ? "border-lapis bg-lapis/5" : "border-line bg-white")}>
                  <span className="font-bold">{i + 1}. {p.id}</span>
                  <span className="font-mono text-xs text-ink-muted">{p.model}</span>
                  <span className="rounded-full bg-sand px-2 text-[0.7rem] font-bold">{t(`aicenter.provider.roles.${p.role}`)}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ink-muted">→</span>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-line px-2.5 py-1.5 text-ink-muted">{t("aicenter.provider.catalogueFallback")}</span>
            </li>
          </ol>
        </>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="py-2 pr-3">{t("aicenter.provider.cols.provider")}</th>
              <th className="py-2 pr-3">{t("aicenter.provider.cols.key")}</th>
              <th className="py-2 pr-3">{t("aicenter.provider.cols.model")}</th>
              <th className="py-2">{t("aicenter.provider.cols.state")}</th>
            </tr>
          </thead>
          <tbody>
            {prov.providers.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-2 pr-3 font-semibold">{t.has(`aicenter.provider.names.${p.id}`) ? t(`aicenter.provider.names.${p.id}`) : p.id}</td>
                <td className="py-2 pr-3">
                  <code className={cn("font-mono text-xs", !p.key && "text-ink-muted")}>{p.key ?? t("aicenter.provider.notSet")}</code>
                  <span className="block text-[0.7rem] text-ink-muted">{p.keyEnv}</span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{p.model ?? "—"}</td>
                <td className="py-2">
                  {p.inChain ? (
                    <span className="inline-flex whitespace-nowrap rounded-full bg-turquoise-ink/10 px-2.5 py-0.5 text-xs font-bold text-turquoise-ink">{t("aicenter.provider.active", { n: p.position ?? 0 })}</span>
                  ) : p.key ? (
                    <span className="inline-flex whitespace-nowrap rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold">{t("aicenter.provider.standby")}</span>
                  ) : (
                    <span className="text-xs text-ink-muted">{t("aicenter.provider.noKey")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t("aicenter.provider.keysNote")}</p>
    </Panel>
  );
}

export function KnowledgePanel({ kb, t, fmt }: { kb: Awaited<ReturnType<typeof knowledgeStats>>; t: T; fmt: Fmt }) {
  const rows: { key: string; v: { published: number; total: number }; note?: string }[] = [
    { key: "tours", v: kb.tours },
    { key: "destinations", v: kb.destinations },
    { key: "attractions", v: kb.attractions, note: t("aicenter.knowledge.mapped", { count: kb.attractions.mapped }) },
    { key: "guides", v: kb.guides },
    { key: "experiences", v: kb.experiences },
    { key: "services", v: kb.services },
    { key: "hotels", v: kb.hotels },
    { key: "restaurants", v: kb.restaurants },
    { key: "transport", v: kb.transport },
    { key: "faq", v: kb.faq },
  ];
  const total = rows.reduce((s, r) => s + r.v.published, 0);
  return (
    <Panel title={t("aicenter.knowledge.title")} className="min-w-0">
      <p className="-mt-2 mb-3 text-sm text-ink-muted">{t("aicenter.knowledge.intro", { count: fmt(total) })}</p>
      <dl className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-3 py-2">
            <dt>
              {t(`aicenter.knowledge.${r.key}`)}
              {r.note && <span className="block text-xs text-ink-muted">{r.note}</span>}
            </dt>
            <dd className="whitespace-nowrap tabular-nums">
              <b>{fmt(r.v.published)}</b>
              {r.v.total !== r.v.published && <span className="text-ink-muted"> / {fmt(r.v.total)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">{t("aicenter.knowledge.note")}</p>
    </Panel>
  );
}

export function ToolsPanel({ tools, usage, t }: { tools: { name: string; description: string }[]; usage: { label: string; value: number; failed: number }[]; t: T }) {
  const byName = new Map(usage.map((u) => [u.label, u]));
  const max = Math.max(1, ...usage.map((u) => u.value));
  return (
    <Panel title={t("aicenter.tools.title")} className="min-w-0">
      <p className="-mt-2 mb-3 text-sm text-ink-muted">{t("aicenter.tools.intro")}</p>
      <ul className="space-y-3">
        {tools.map((tool) => {
          const u = byName.get(tool.name);
          return (
            <li key={tool.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <code className="font-mono text-xs font-bold text-lapis-deep">{tool.name}</code>
                  <span className="ml-2 text-ink">{t.has(`aicenter.tools.names.${tool.name}`) ? t(`aicenter.tools.names.${tool.name}`) : ""}</span>
                </span>
                <span className="tabular-nums text-ink-muted">
                  {t("aicenter.tools.calls", { count: u?.value ?? 0 })}
                  {u?.failed ? <span className="text-danger"> · {t("aicenter.tools.failed", { count: u.failed })}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-sand-soft">
                <div className="h-2 rounded-full bg-turquoise-ink" style={{ width: `${((u?.value ?? 0) / max) * 100}%`, minWidth: u?.value ? 4 : 0 }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function OutcomePanel({ stats, t }: { stats: Awaited<ReturnType<typeof aiStats>>; t: T }) {
  const rows = [
    { label: t("aicenter.status.ok"), value: stats.ok },
    { label: t("aicenter.status.unanswered"), value: stats.unanswered },
    { label: t("aicenter.status.fallback"), value: stats.fallback },
    { label: t("aicenter.status.error"), value: stats.errors },
  ];
  return (
    <Panel title={t("aicenter.outcomes.title")} className="min-w-0">
      {stats.replies === 0 ? <Empty>{t("aicenter.noData")}</Empty> : <HBars rows={rows} color="#26458f" />}
      {stats.byProvider.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-muted">{t("aicenter.outcomes.byProvider")}</p>
          <HBars rows={stats.byProvider} color="#2f8f8b" />
        </>
      )}
    </Panel>
  );
}

// ── Usage & failures ───────────────────────────────────────────────────────

export function UsagePanels({ usage, failures, t, fmt, ms }: { usage: Awaited<ReturnType<typeof usageStats>>; failures: Awaited<ReturnType<typeof failedRequests>>; t: T; fmt: Fmt; ms: (d: string) => string }) {
  const totalRequests = usage.series.reduce((s, d) => s + d.requests, 0);
  const totalFailed = usage.series.reduce((s, d) => s + d.failed, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("aicenter.usage.requests")} value={fmt(totalRequests)} hint={t("aicenter.last30")} />
        <StatTile label={t("aicenter.usage.answered")} value={fmt(usage.series.reduce((s, d) => s + d.ok, 0))} hint={t("aicenter.usage.answeredHint")} />
        <StatTile label={t("aicenter.usage.failed")} value={fmt(totalFailed)} hint={t("aicenter.usage.failedHint")} />
      </div>
      <Panel title={t("aicenter.usage.perDay")}>
        {totalRequests === 0 ? (
          <Empty>{t("aicenter.noData")}</Empty>
        ) : (
          <BarChart
            label={t("aicenter.usage.perDay")}
            data={usage.series.map((d) => ({ x: d.day, y: d.requests, short: ms(d.day) }))}
            tooltip={(d) => t("aicenter.usage.dayTooltip", { count: d.y, day: ms(d.x) })}
            tableHeaders={[t("aicenter.usage.day"), t("aicenter.usage.requests")]}
          />
        )}
      </Panel>
      <Panel title={t("aicenter.usage.providers")}>
        {usage.providers.length === 0 ? (
          <Empty>{t("aicenter.usage.noProviderData")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">{t("aicenter.usage.cols.model")}</th>
                  <th className="py-2 pr-3 text-right">{t("aicenter.usage.cols.replies")}</th>
                  <th className="py-2 pr-3 text-right">{t("aicenter.usage.cols.latency")}</th>
                  <th className="py-2 pr-3 text-right">{t("aicenter.usage.cols.tokens")}</th>
                  <th className="py-2">{t("aicenter.usage.cols.last")}</th>
                </tr>
              </thead>
              <tbody>
                {usage.providers.map((p) => (
                  <tr key={p.provider + p.model} className="border-t border-line">
                    <td className="py-2 pr-3"><b>{p.provider}</b> <span className="font-mono text-xs text-ink-muted">{p.model}</span></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(p.replies)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{t("aicenter.seconds", { s: seconds(p.avgLatencyMs) })}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(p.tokensIn)} / {fmt(p.tokensOut)}</td>
                    <td className="whitespace-nowrap py-2 text-xs text-ink-muted">{p.lastAt ? stamp(p.lastAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">{t("aicenter.usage.latencyNote")}</p>
      </Panel>
      <Panel title={t("aicenter.failures.title")}>
        <p className="-mt-2 mb-4 text-sm text-ink-muted">{t("aicenter.failures.intro")}</p>
        {failures.rows.length === 0 ? (
          <Empty>{t("aicenter.failures.empty")}</Empty>
        ) : (
          <>
            <div className="mb-5 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-muted">{t("aicenter.failures.byKind")}</p>
                <HBars rows={failures.groups} color="#b5532e" />
              </div>
              <p className="self-end text-sm text-ink-muted">{t("aicenter.failures.toolFailures", { count: failures.toolFailures })}</p>
            </div>
            <div className={tableCls.wrap}>
              <table className={cn(tableCls.table, "min-w-[46rem]")}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>{t("aicenter.logs.cols.time")}</th>
                    <th className={tableCls.th}>{t("aicenter.logs.cols.status")}</th>
                    <th className={tableCls.th}>{t("aicenter.failures.error")}</th>
                    <th className={tableCls.th}>{t("aicenter.logs.cols.question")}</th>
                    <th className={cn(tableCls.th, "relative")}><span className="sr-only">{t("aicenter.logs.open")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {failures.rows.map((r) => (
                    <tr key={r.id}>
                      <td className={cn(tableCls.td, "whitespace-nowrap text-xs")}>{stamp(r.createdAt)}{r.isTest && <span className="ml-1 rounded-full bg-lapis/10 px-1.5 text-[0.65rem] font-bold text-lapis">{t("aicenter.logs.test")}</span>}</td>
                      <td className={tableCls.td}><StatusPill status={r.status} t={t} /></td>
                      <td className={cn(tableCls.td, "max-w-[18rem]")}><span className="line-clamp-3 break-words font-mono text-xs">{r.error ?? t("aicenter.failures.noDetail")}</span></td>
                      <td className={cn(tableCls.td, "max-w-[20rem]")}><span className="line-clamp-2">{r.question ?? "—"}</span></td>
                      <td className={tableCls.td}><Link href={`/admin/ai/${r.conversationId}`} className="inline-flex min-h-11 items-center font-semibold text-lapis underline">{t("aicenter.logs.open")}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

// ── Conversation logs ──────────────────────────────────────────────────────

export function ConversationTable({ rows, t, fmt }: { rows: Awaited<ReturnType<typeof recentConversations>>; t: T; fmt: Fmt }) {
  if (rows.length === 0) return <Empty>{t("aicenter.logs.empty")}</Empty>;
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((c) => (
          <li key={c.id} className="rounded-sm border border-line bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>{stamp(c.createdAt)} · {c.locale.toUpperCase()} · {c.isTest ? t("aicenter.logs.test") : t(`aicenter.logs.sources.${c.source}`)}</span>
              <StatusPill status={c.lastStatus} t={t} />
            </div>
            <p className="mt-1 line-clamp-3 text-sm">{c.firstQuestion ?? "—"}</p>
            <Link href={`/admin/ai/${c.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-lapis underline">{t("aicenter.logs.open")}</Link>
          </li>
        ))}
      </ul>
      <div className={cn(tableCls.wrap, "hidden md:block")}>
        <table className={cn(tableCls.table, "min-w-[52rem]")}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("aicenter.logs.cols.time")}</th>
              <th className={tableCls.th}>{t("aicenter.logs.cols.lang")}</th>
              <th className={tableCls.th}>{t("aicenter.logs.cols.source")}</th>
              <th className={tableCls.th}>{t("aicenter.logs.cols.question")}</th>
              <th className={tableCls.th}>{t("aicenter.logs.cols.provider")}</th>
              <th className={cn(tableCls.th, "text-right")}>{t("aicenter.logs.cols.tokens")}</th>
              <th className={tableCls.th}>{t("aicenter.logs.cols.status")}</th>
              <th className={cn(tableCls.th, "relative")}><span className="sr-only">{t("aicenter.logs.open")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-sand-soft/40">
                <td className={cn(tableCls.td, "whitespace-nowrap text-xs")}>{stamp(c.createdAt)}<span className="block font-mono text-[0.65rem] text-ink-muted">{c.id.slice(0, 10)}</span></td>
                <td className={cn(tableCls.td, "uppercase")}>{c.locale}</td>
                <td className={tableCls.td}>
                  {c.isTest ? <span className="rounded-full bg-lapis/10 px-2 py-0.5 text-xs font-bold text-lapis">{t("aicenter.logs.test")}</span> : t(`aicenter.logs.sources.${c.source}`)}
                </td>
                <td className={cn(tableCls.td, "max-w-[22rem]")}>
                  <span className="line-clamp-2">{c.firstQuestion ?? "—"}</span>
                  {c.bookingReference && <span className="text-xs font-semibold text-turquoise-ink">{c.bookingReference}</span>}
                </td>
                <td className={cn(tableCls.td, "text-xs")}>{c.lastProvider ?? "—"}</td>
                <td className={cn(tableCls.td, "text-right tabular-nums")}>{fmt(Number(c.tokens))}</td>
                <td className={tableCls.td}><StatusPill status={c.lastStatus} t={t} />{c.rating != null && Number(c.rating) !== 0 && <span className={cn("mt-1 block text-xs font-semibold", Number(c.rating) > 0 ? "text-success" : "text-danger")}>{Number(c.rating) > 0 ? t("aicenter.logs.ratedUp") : t("aicenter.logs.ratedDown")}</span>}</td>
                <td className={tableCls.td}><Link href={`/admin/ai/${c.id}`} className="inline-flex min-h-11 items-center font-semibold text-lapis underline">{t("aicenter.logs.open")}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Model configuration ────────────────────────────────────────────────────

export function ModelConfigPanel({ prov, t }: { prov: ProviderStatus; t: T }) {
  const rows = Object.entries(prov.config) as [keyof ProviderStatus["config"], string | null][];
  return (
    <Panel title={t("aicenter.config.title")} className="min-w-0">
      <p className="-mt-2 mb-3 text-sm text-ink-muted">{t("aicenter.config.intro")}</p>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
            <dt>
              <span className="font-semibold">{t(`aicenter.config.keys.${k}`)}</span>
              <code className="block font-mono text-[0.7rem] text-ink-muted">{k}</code>
            </dt>
            <dd className={cn("break-words font-mono text-xs sm:text-right", !v && "text-ink-muted")}>{v ?? t("aicenter.config.default")}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
