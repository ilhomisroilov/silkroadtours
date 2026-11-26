import { ArrowRight, ArrowUpRight, BellRing } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/admin/ui";
import type { CrmStats } from "@/db/queries/crm";
import { cn } from "@/lib/cn";
import { BOARD_STAGES, usd } from "./shared";

type T = (key: string, values?: Record<string, string | number>) => string;

function LinkTile({ href, label, value, hint, tone, testId }: { href: string; label: string; value: string; hint?: ReactNode; tone?: "danger" | "warn"; testId?: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "group block rounded-sm border bg-white p-5 shadow-sm transition-colors hover:border-cobalt",
        tone === "danger" ? "border-danger/40" : tone === "warn" ? "border-saffron/60" : "border-line",
      )}
    >
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted">
        <span className="flex items-center gap-1.5">
          {tone && <BellRing aria-hidden="true" className={cn("size-4", tone === "danger" ? "text-danger" : "text-saffron-ink")} />}
          {label}
        </span>
        <ArrowUpRight aria-hidden="true" className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </p>
      <p className={cn("mt-1 break-words font-display text-3xl font-bold tabular-nums", tone === "danger" ? "text-danger" : "text-ink")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Link>
  );
}

/** CRM block of the admin overview: real counts from the leads table, each linking into /admin/crm. */
export function CrmOverview({ stats, t, locale }: { stats: CrmStats; t: T; locale: string }) {
  const won = stats.byStage.confirmed.count + stats.byStage.completed.count;
  const maxStage = Math.max(1, ...BOARD_STAGES.map((s) => stats.byStage[s].count));
  const maxSource = Math.max(1, ...stats.bySource.map((s) => s.count));
  const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(stats.conversion);
  return (
    <section aria-labelledby="crm-overview" data-testid="crm-overview">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="crm-overview" className="text-2xl text-lapis-deep">{t("dashboard.title")}</h2>
        <Link href="/admin/crm" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-lapis-deep hover:bg-sand-soft">
          {t("dashboard.open")} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkTile href="/admin/crm" label={t("dashboard.pipeline")} value={usd(stats.pipelineUsd, locale)} hint={t("dashboard.pipelineHint")} testId="crm-tile-pipeline" />
        <LinkTile href="/admin/crm?view=table&stage=confirmed" label={t("dashboard.conversion")} value={pct} hint={t("dashboard.conversionHint", { won, total: stats.total })} />
        <LinkTile href="/admin/crm?view=table&sort=created" label={t("dashboard.newLeads")} value={String(stats.newLast7)} hint={t("dashboard.newLeadsHint")} />
        <div className={cn("rounded-sm border bg-white p-5 shadow-sm", stats.followUpsOverdue > 0 ? "border-danger/40" : "border-line")} data-testid="crm-tile-followups">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
            <BellRing aria-hidden="true" className={cn("size-4", stats.followUpsOverdue > 0 ? "text-danger" : "text-cobalt")} />
            {t("dashboard.followUps")}
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-x-5 gap-y-1">
            <Link href="/admin/crm?view=table&followUp=overdue&sort=followUp&dir=asc" className="group rounded-sm" data-testid="crm-tile-overdue">
              <span className={cn("block font-display text-3xl font-bold tabular-nums", stats.followUpsOverdue > 0 ? "text-danger" : "text-ink")}>{stats.followUpsOverdue}</span>
              <span className="text-xs font-semibold text-ink-muted underline-offset-2 group-hover:underline">{t("dashboard.followUpsOverdue")}</span>
            </Link>
            <Link href="/admin/crm?view=table&followUp=today&sort=followUp&dir=asc" className="group rounded-sm">
              <span className="block font-display text-3xl font-bold tabular-nums text-ink">{stats.followUpsToday}</span>
              <span className="text-xs font-semibold text-ink-muted underline-offset-2 group-hover:underline">{t("dashboard.followUpsToday")}</span>
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={t("dashboard.funnel")} className="xl:col-span-2">
          {stats.total === 0 ? (
            <p className="text-ink-muted">{t("dashboard.noLeads")}</p>
          ) : (
            <>
              <p className="-mt-2 mb-4 text-sm text-ink-muted">{t("dashboard.funnelHint")}</p>
              <ol className="space-y-2.5">
                {BOARD_STAGES.map((s) => {
                  const { count, valueUsd } = stats.byStage[s];
                  const label = t(`stages.${s}`);
                  return (
                    <li key={s}>
                      <Link
                        href={`/admin/crm?view=table&stage=${s}`}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-sm px-1 py-0.5 hover:bg-sand-soft sm:grid-cols-[minmax(6.5rem,9rem)_1fr_auto]"
                        title={`${label}: ${count} · ${usd(valueUsd, locale)}`}
                      >
                        <span className="truncate text-sm font-semibold">{label}</span>
                        <span className="order-3 col-span-2 h-3 rounded-full bg-sand-soft sm:order-2 sm:col-span-1" aria-hidden="true">
                          <span className="block h-3 rounded-full bg-cobalt" style={{ width: `${(count / maxStage) * 100}%`, minWidth: count > 0 ? 6 : 0 }} />
                        </span>
                        <span className="order-2 min-w-[5.5rem] text-right text-sm tabular-nums sm:order-3">
                          <span className="font-bold text-ink">{count}</span>
                          <span className="text-ink-muted"> · {usd(valueUsd, locale)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
                <Link href="/admin/crm?view=table&stage=lost" className="font-semibold text-danger underline-offset-2 hover:underline">{t("dashboard.lost", { count: stats.byStage.lost.count })}</Link>
                {" · "}
                {t("dashboard.won")}: <span className="font-semibold text-ink">{usd(stats.wonUsd, locale)}</span>
              </p>
            </>
          )}
        </Panel>
        <Panel title={t("dashboard.bySource")}>
          {stats.bySource.length === 0 ? (
            <p className="text-ink-muted">{t("dashboard.noLeads")}</p>
          ) : (
            <ul className="space-y-3">
              {stats.bySource.map((r) => (
                <li key={r.source}>
                  <Link href={`/admin/crm?view=table&source=${r.source}`} className="block rounded-sm px-1 py-0.5 hover:bg-sand-soft" title={`${t(`sources.${r.source}`)}: ${r.count}`}>
                    <span className="flex justify-between text-sm">
                      <span className="font-semibold">{t(`sources.${r.source}`)}</span>
                      <span className="tabular-nums text-ink-muted">{r.count}</span>
                    </span>
                    <span className="mt-1 block h-2.5 rounded-full bg-sand-soft" aria-hidden="true">
                      <span className="block h-2.5 rounded-full bg-lapis" style={{ width: `${(r.count / maxSource) * 100}%`, minWidth: r.count > 0 ? 4 : 0 }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
