import { ArrowDown, ArrowUp, ArrowUpDown, KanbanSquare, Plus, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/admin/list-tools";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { KanbanBoard } from "@/components/admin/crm/kanban-board";
import { FollowUpChip, ManagerAvatar, SourceBadge, StageBadge } from "@/components/admin/crm/lead-card";
import { dateLabel, dateRange, OPEN_STAGE_SET, prettyDestination, serviceTypeKey, usd, type CrmLeadCard } from "@/components/admin/crm/shared";
import { getDb } from "@/db/client";
import { getCrmStats, listActiveAdmins, listLeadDestinations, listLeads, type LeadRow } from "@/db/queries/crm";
import { LEAD_SOURCES, LEAD_STAGES } from "@/db/types";
import { cn } from "@/lib/cn";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { getTranslations } from "next-intl/server";
import { todayInTashkent } from "@/validators/common";
import { FOLLOW_UP_FILTERS, leadListQuerySchema, type LeadListQuery, type LeadSort } from "@/validators/lead";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("crm.title") };
}

/** Parses the URL filters, dropping any single invalid value instead of the whole query. */
function parseFilters(raw: Record<string, string>): LeadListQuery {
  let input = { ...raw };
  for (let i = 0; i < 12; i++) {
    const r = leadListQuerySchema.safeParse(input);
    if (r.success) return r.data;
    const bad = new Set(r.error.issues.map((x) => String(x.path[0])));
    input = Object.fromEntries(Object.entries(input).filter(([k]) => !bad.has(k)));
  }
  return leadListQuerySchema.parse({});
}

const toCard = (l: LeadRow, title: string): CrmLeadCard => ({
  id: l.id,
  stage: l.stage,
  source: l.source,
  sourceRef: l.sourceRef,
  fullName: l.fullName,
  email: l.email,
  title,
  destination: l.destination,
  travelFrom: l.travelFrom,
  travelTo: l.travelTo,
  travellers: l.travellers,
  valueUsd: l.valueUsd,
  budgetUsd: l.budgetUsd,
  assignedName: l.assignedName,
  followUpAt: l.followUpAt,
});

const FILTER_KEYS = ["q", "stage", "source", "assigned", "destination", "followUp"] as const;

export default async function CrmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const tm = await getTranslations({ locale, namespace: "monthsShort" });
  const ms = (m: number) => tm(String(m) as never);
  const sp = await searchParams;
  const raw = Object.fromEntries(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v !== "" ? [[k, v]] : [])));
  const view = raw.view === "table" ? "table" : "board";
  const q = parseFilters(raw);
  const today = todayInTashkent();
  const db = getDb();

  const [admins, destinations, stats, data] = await Promise.all([
    listActiveAdmins(db),
    listLeadDestinations(db),
    getCrmStats(db, today),
    view === "board" ? listLeads(db, { ...q, stage: undefined, sort: "updated", dir: "desc", page: 1, pageSize: 500 }, today) : listLeads(db, q, today),
  ]);

  // Links keep the current filters; `extra` overrides (undefined removes a key).
  const filterParams: Record<string, string | undefined> = Object.fromEntries(FILTER_KEYS.map((k) => [k, q[k] != null ? String(q[k]) : undefined]));
  if (view === "board") filterParams.stage = undefined;
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filterParams, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/crm${s ? `?${s}` : ""}`;
  };
  const tableParams = { ...filterParams, view: "table", sort: q.sort !== "created" ? q.sort : undefined, dir: q.dir !== "desc" ? q.dir : undefined };
  const activeFilters = FILTER_KEYS.filter((k) => filterParams[k]).length;
  const tc = (k: string, v?: Record<string, string | number>) => t(`crm.${k}` as never, v as never);
  const titleOf = (l: LeadRow) => {
    const k = serviceTypeKey(l.title);
    return k ? t(`requests.types.${k}`) : l.title;
  };

  const input = "min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
  const sortHeader = (key: LeadSort, label: string, className?: string) => {
    const active = q.sort === key;
    const nextDir = active && q.dir === "desc" ? "asc" : "desc";
    const Icon = active ? (q.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th scope="col" className={cn(tableCls.th, className)} aria-sort={active ? (q.dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={href({ view: "table", sort: key, dir: nextDir, page: undefined })} className="inline-flex items-center gap-1 hover:text-lapis" aria-label={t("crm.table.sortBy", { column: label })}>
          {label}
          <Icon aria-hidden="true" className={cn("size-3.5", !active && "opacity-40")} />
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader
        title={t("crm.title")}
        actions={
          <Link href="/admin/crm/new" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 font-semibold text-white hover:bg-lapis-deep" data-testid="crm-new-lead">
            <Plus aria-hidden="true" className="size-4" /> {t("crm.newLead")}
          </Link>
        }
      >
        <p className="mt-1 text-ink-muted">{t("crm.summary", { count: stats.total, value: usd(stats.pipelineUsd, locale) })}</p>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-white p-1 shadow-sm" role="group" aria-label={t("crm.viewLabel")}>
          {(["board", "table"] as const).map((v) => {
            const Icon = v === "board" ? KanbanSquare : Table2;
            return (
              <Link
                key={v}
                href={v === "board" ? href({ stage: undefined }) : href({ view: "table", stage: filterParams.stage })}
                aria-current={view === v ? "page" : undefined}
                className={cn("inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold", view === v ? "bg-lapis-deep text-ivory" : "text-lapis-deep hover:bg-sand-soft")}
                data-testid={`crm-view-${v}`}
              >
                <Icon aria-hidden="true" className="size-4" /> {t(`crm.views.${v}`)}
              </Link>
            );
          })}
        </div>
        {activeFilters > 0 && (
          <p className="text-sm text-ink-muted">
            {t("crm.filters.active", { count: activeFilters })} ·{" "}
            <Link href={view === "table" ? "/admin/crm?view=table" : "/admin/crm"} className="font-semibold text-cobalt underline">{t("crm.filters.reset")}</Link>
          </p>
        )}
      </div>

      <form method="get" action="/admin/crm" className="mb-5 flex flex-wrap items-end gap-3 rounded-sm border border-line bg-white p-4 shadow-sm" data-testid="crm-filters">
        {view === "table" && <input type="hidden" name="view" value="table" />}
        {view === "table" && q.sort !== "created" && <input type="hidden" name="sort" value={q.sort} />}
        {view === "table" && q.dir !== "desc" && <input type="hidden" name="dir" value={q.dir} />}
        <label className="flex flex-[2_1_12rem] flex-col gap-1 text-sm font-semibold max-sm:basis-full">
          {t("crm.filters.search")}
          <input type="search" name="q" defaultValue={q.q ?? ""} placeholder={t("crm.filters.searchPlaceholder")} className={input} />
        </label>
        {view === "table" && (
          <label className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1 text-sm font-semibold">
            {t("crm.filters.stage")}
            <select name="stage" defaultValue={q.stage ?? ""} className={input}>
              <option value="">{t("common.all")}</option>
              {LEAD_STAGES.map((s) => <option key={s} value={s}>{t(`crm.stages.${s}`)}</option>)}
            </select>
          </label>
        )}
        <label className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1 text-sm font-semibold">
          {t("crm.filters.source")}
          <select name="source" defaultValue={q.source ?? ""} className={input}>
            <option value="">{t("common.all")}</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{t(`crm.sources.${s}`)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1 text-sm font-semibold">
          {t("crm.filters.manager")}
          <select name="assigned" defaultValue={q.assigned != null ? String(q.assigned) : ""} className={input}>
            <option value="">{t("common.all")}</option>
            <option value="none">{t("crm.filters.unassigned")}</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1 text-sm font-semibold">
          {t("crm.filters.destination")}
          <select name="destination" defaultValue={q.destination ?? ""} className={input}>
            <option value="">{t("common.all")}</option>
            {destinations.map((d) => <option key={d} value={d}>{prettyDestination(d)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1_1_8rem] flex-col gap-1 text-sm font-semibold">
          {t("crm.filters.followUp")}
          <select name="followUp" defaultValue={q.followUp ?? ""} className={input}>
            <option value="">{t("common.all")}</option>
            {FOLLOW_UP_FILTERS.map((f) => <option key={f} value={f}>{t(`crm.followUpFilter.${f}`)}</option>)}
          </select>
        </label>
        <button type="submit" className="inline-flex min-h-11 flex-[0_0_auto] items-center justify-center rounded-full bg-lapis px-6 font-semibold text-white hover:bg-lapis-deep max-sm:w-full">{t("crm.filters.apply")}</button>
      </form>

      {view === "board" ? (
        <KanbanBoard leads={data.items.map((l) => toCard(l, titleOf(l)))} today={today} locale={locale} />
      ) : (
        <>
          <div className={tableCls.wrap}>
            <table className={tableCls.table} data-testid="crm-table">
              <caption className="sr-only">{t("crm.table.caption")}</caption>
              <thead className={tableCls.thead}>
                <tr>
                  {sortHeader("name", t("crm.table.lead"))}
                  {sortHeader("stage", t("crm.table.stage"))}
                  <th scope="col" className={tableCls.th}>{t("crm.table.source")}</th>
                  <th scope="col" className={tableCls.th}>{t("crm.table.manager")}</th>
                  {sortHeader("value", t("crm.table.value"), "text-right")}
                  {sortHeader("travel", t("crm.table.travel"))}
                  {sortHeader("followUp", t("crm.table.followUp"))}
                  {sortHeader("created", t("crm.table.created"))}
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr><td colSpan={8} className={`${tableCls.td} py-10 text-center text-ink-muted`}>{t("crm.table.empty")}</td></tr>
                )}
                {data.items.map((l) => {
                  const dest = prettyDestination(l.destination);
                  return (
                    <tr key={l.id} className="hover:bg-sand-soft/50">
                      <td className={cn(tableCls.td, "min-w-52")}>
                        <Link href={`/admin/crm/${l.id}`} className="font-bold text-lapis underline-offset-2 hover:underline">{l.fullName}</Link>
                        <div className="line-clamp-1 text-xs text-ink-muted">{titleOf(l)}</div>
                        {dest && <div className="text-xs text-ink">{dest}</div>}
                        <div className="text-xs text-ink-muted">{l.email}</div>
                      </td>
                      <td className={tableCls.td}><StageBadge stage={l.stage} label={t(`crm.stages.${l.stage}`)} /></td>
                      <td className={tableCls.td}>
                        <SourceBadge source={l.source} label={t(`crm.sources.${l.source}`)} />
                        {l.sourceRef && <div className="mt-1 whitespace-nowrap text-xs text-ink-muted">{l.sourceRef}</div>}
                      </td>
                      <td className={tableCls.td}>
                        <span className="flex items-center gap-2">
                          <ManagerAvatar name={l.assignedName} label={l.assignedName ? t("crm.card.assignedTo", { name: l.assignedName }) : t("crm.card.unassigned")} />
                          <span className="whitespace-nowrap text-sm">{l.assignedName ?? "—"}</span>
                        </span>
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap text-right tabular-nums")}>
                        {l.valueUsd != null ? <span className="font-semibold">{usd(l.valueUsd, locale)}</span> : l.budgetUsd != null ? <span className="text-ink-muted">{t("crm.card.budget", { value: usd(l.budgetUsd, locale) })}</span> : "—"}
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap")}>
                        {dateRange(l.travelFrom, l.travelTo, ms) ?? "—"}
                        {l.travellers ? <div className="text-xs text-ink-muted">{t("crm.card.travellers", { count: l.travellers })}</div> : null}
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap")}>
                        <FollowUpChip followUpAt={l.followUpAt} stage={l.stage} today={today} t={tc} ms={ms} compact />
                        {l.followUpAt && !OPEN_STAGE_SET.has(l.stage) && <span className="text-xs text-ink-muted">{dateLabel(l.followUpAt, ms)}</span>}
                        {!l.followUpAt && "—"}
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap text-xs text-ink-muted")}>{dateLabel(l.createdAt.toISOString().slice(0, 10), ms)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            base="/admin/crm"
            params={tableParams}
            labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: data.page, pages: Math.max(1, Math.ceil(data.total / data.pageSize)) }) }}
          />
        </>
      )}
    </>
  );
}
