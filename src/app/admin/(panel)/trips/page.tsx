import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/admin/list-tools";
import { PageHeader, StatTile, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { listTripSnapshots, requestsForTrips } from "@/lib/server/trips";

const PAGE_SIZE = 30;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("trips.title") };
}

/** Trip Constructor plans visitors saved or shared (read-only). */
export default async function AdminTrips({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
  const db = getDb();
  const [list, destinations] = await Promise.all([listTripSnapshots(db, { page, pageSize: PAGE_SIZE }), listPublishedDestinations(db)]);
  const requests = await requestsForTrips(db, list.items.map((s) => s.id));
  const name = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const withRequests = list.items.filter((s) => requests.has(s.id)).length;
  const avg = list.items.length ? list.items.reduce((a, s) => a + s.estimate.totalUsd, 0) / list.items.length : 0;
  return (
    <>
      <PageHeader title={t("trips.title")}>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("trips.lead")}</p>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label={t("trips.statSaved")} value={String(list.total)} />
        <StatTile label={t("trips.statRequested")} value={String(withRequests)} hint={t("trips.statOnPage")} />
        <StatTile label={t("trips.statAverage")} value={usd(avg)} hint={t("trips.statOnPage")} />
      </div>
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("trips.created")}</th>
              <th className={tableCls.th}>{t("trips.trip")}</th>
              <th className={tableCls.th}>{t("trips.destinations")}</th>
              <th className={tableCls.th}>{t("trips.travellers")}</th>
              <th className={tableCls.th}>{t("trips.items")}</th>
              <th className={tableCls.th}>{t("trips.total")}</th>
              <th className={tableCls.th}>{t("trips.requests")}</th>
              <th className={tableCls.th}>{t("trips.link")}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && (
              <tr>
                <td colSpan={8} className={`${tableCls.td} text-center text-ink-muted`}>
                  {t("trips.empty")}
                </td>
              </tr>
            )}
            {list.items.map((s) => {
              const reqs = requests.get(s.id) ?? [];
              return (
                <tr key={s.id} className="hover:bg-sand-soft/50">
                  <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{s.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className={tableCls.td}>
                    <Link className="font-bold text-lapis underline" href={`/admin/trips/${s.id}`}>
                      {s.trip.title || t("trips.untitled")}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {s.id} · {s.locale.toUpperCase()}
                      {s.trip.startDate && ` · ${s.trip.startDate} → ${s.trip.endDate ?? "?"}`}
                    </div>
                  </td>
                  <td className={tableCls.td}>{s.trip.destinations.map((d) => name.get(d) ?? d).join(", ") || "—"}</td>
                  <td className={tableCls.td}>{t("trips.pax", { adults: s.trip.adults, children: s.trip.children })}</td>
                  <td className={tableCls.td}>{s.trip.items.length}</td>
                  <td className={`${tableCls.td} whitespace-nowrap font-semibold`}>
                    {usd(s.estimate.totalUsd)}
                    <div className="text-xs font-normal text-ink-muted">{t("trips.days", { count: s.estimate.days })}</div>
                  </td>
                  <td className={tableCls.td}>
                    {reqs.length ? (
                      reqs.map((r) => (
                        <Link key={r.id} href={`/admin/requests/${r.id}`} className="block font-semibold text-cobalt underline">
                          {r.reference}
                        </Link>
                      ))
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className={tableCls.td}>
                    <a href={`/${s.locale === "uz" || s.locale === "ru" ? s.locale : "en"}/trip-builder?trip=${s.id}`} target="_blank" rel="noopener" className="whitespace-nowrap font-semibold text-cobalt underline">
                      {t("trips.open")} ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={list.total}
        base="/admin/trips"
        params={{}}
        labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page, pages: Math.max(1, Math.ceil(list.total / PAGE_SIZE)) }) }}
      />
    </>
  );
}
