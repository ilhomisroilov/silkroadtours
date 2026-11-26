import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, HBars, PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getDashboardStats } from "@/db/queries/stats";
import { getCrmStats } from "@/db/queries/crm";
import { CrmOverview } from "@/components/admin/crm/overview";
import { todayInTashkent } from "@/validators/common";
import { BOOKING_STATUSES, SERVICE_TYPES } from "@/db/types";
import { formatDateLabel } from "@/lib/format";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("overview.title") };
}

export default async function AdminOverview() {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const tm = await getTranslations({ locale, namespace: "monthsShort" });
  const ms = (m: number) => tm(String(m) as never);
  const ta = await getTranslations({ locale, namespace: "audience" });
  const [s, crm] = await Promise.all([getDashboardStats(getDb(), {}), getCrmStats(getDb(), todayInTashkent())]);
  const tc = (k: string, v?: Record<string, string | number>) => t(`crm.${k}` as never, v as never);
  const usd = (c: number) => formatMoney(Math.round(c / 100) * 100, "USD", locale);
  const inbound = s.byAudience.find((a) => a.audience === "inbound")?.bookings ?? 0;
  const domestic = s.byAudience.find((a) => a.audience === "domestic")?.bookings ?? 0;
  const splitTotal = inbound + domestic;
  return (
    <>
      <PageHeader title={t("overview.title")} />
      <CrmOverview stats={crm} t={tc} locale={locale} />
      <section aria-labelledby="bookings-overview" className="mt-10">
      <div className="mb-4">
        <h2 id="bookings-overview" className="text-2xl text-lapis-deep">{t("nav.bookings")}</h2>
        <p className="mt-1 text-ink-muted">{t("overview.last30")} · {formatDateLabel(s.range.from, ms)} – {formatDateLabel(s.range.to, ms)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("overview.bookings")} value={String(s.totals.bookings)} />
        <StatTile label={t("overview.guests")} value={String(s.totals.guests)} />
        <StatTile label={t("overview.revenue")} value={usd(s.totals.revenueUsdCents)} hint={t("overview.revenueHint")} />
        <StatTile label={t("overview.pipeline")} value={usd(s.totals.pipelineUsdCents)} hint={t("overview.pipelineHint")} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={t("overview.daily")} className="xl:col-span-2">
          {s.totals.bookings === 0 ? (
            <p className="text-ink-muted">{t("overview.noData")}</p>
          ) : (
            <BarChart
              label={t("overview.daily")}
              data={s.daily.map((d) => ({ x: d.day, y: d.bookings, short: formatDateLabel(d.day, ms, false) }))}
              tooltip={(d) => t("overview.dailyLabel", { count: d.y, day: formatDateLabel(d.x, ms) })}
              tableHeaders={[t("bookings.created"), t("overview.bookings")]}
            />
          )}
        </Panel>
        <Panel title={t("overview.funnel")}>
          <HBars rows={BOOKING_STATUSES.map((st) => ({ label: t(`status.${st}`), value: Number(s.byStatus[st] ?? 0) }))} />
        </Panel>
        <Panel title={t("overview.split")}>
          {splitTotal === 0 ? (
            <p className="text-ink-muted">{t("overview.noData")}</p>
          ) : (
            <>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                <div style={{ width: `${(inbound / splitTotal) * 100}%`, background: "#1e5aa8" }} />
                <div style={{ width: `${(domestic / splitTotal) * 100}%`, background: "#b5532e" }} />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: "#1e5aa8" }} />{ta("inboundShort")}</span><span className="font-semibold tabular-nums">{inbound} ({Math.round((inbound / splitTotal) * 100)}%)</span></li>
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: "#b5532e" }} />{ta("domesticShort")}</span><span className="font-semibold tabular-nums">{domestic} ({Math.round((domestic / splitTotal) * 100)}%)</span></li>
              </ul>
            </>
          )}
        </Panel>
        <Panel title={t("overview.topDestinations")}>
          {s.topDestinations.length === 0 ? <p className="text-ink-muted">{t("overview.noData")}</p> : <HBars rows={s.topDestinations.map((d) => ({ label: localize(d.name, locale), value: d.bookings }))} />}
        </Panel>
        <Panel title={t("overview.requests")}>
          <HBars rows={SERVICE_TYPES.map((st) => ({ label: t(`requests.types.${st}`), value: Number(s.serviceRequestsByType[st] ?? 0) }))} />
        </Panel>
        <Panel title={t("overview.upcoming")} className="xl:col-span-3">
          {s.upcomingDepartures.length === 0 ? (
            <p className="text-ink-muted">{t("common.empty")}</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {s.upcomingDepartures.map((d) => (
                <li key={d.id} className="rounded-sm border border-line p-3">
                  <Link href={`/admin/tours/${d.tourId}?tab=departures`} className="font-semibold text-lapis hover:underline">{localize(d.tourTitle, locale)}</Link>
                  <p className="text-sm text-ink-muted">{formatDateLabel(d.startDate, ms)} · {t("overview.seats", { booked: d.seatsBooked, total: d.seatsTotal })}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-sand-soft"><div className="h-1.5 rounded-full bg-cobalt" style={{ width: `${(d.seatsBooked / d.seatsTotal) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </section>
    </>
  );
}
