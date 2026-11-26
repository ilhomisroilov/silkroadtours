import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HBars, PageHeader, Panel, StatTile } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { BUDGET_CATEGORIES, estimateBudget, itemHref, orderedItems } from "@/lib/trip-helpers";
import { getTripSnapshot, requestsForTrips } from "@/lib/server/trips";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("trips.title") };
}

export default async function AdminTripDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const db = getDb();
  const snap = await getTripSnapshot(db, (await params).id);
  if (!snap) notFound();
  const [destinations, requests] = await Promise.all([listPublishedDestinations(db), requestsForTrips(db, [snap.id])]);
  const name = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const trip = snap.trip;
  const budget = estimateBudget(trip, { includeMeals: snap.includeMeals && trip.items.length > 0 });
  const items = orderedItems(trip.items);
  const days = [...new Set(items.map((i) => (i.day && i.day <= budget.days ? i.day : 0)))].sort((a, b) => (a || 99) - (b || 99));
  const siteLocale = snap.locale === "uz" || snap.locale === "ru" ? snap.locale : "en";
  const unit = (u?: string) => (u ? t(`trips.unit.${u}` as "trips.unit.night") : "");
  return (
    <>
      <p className="mb-2">
        <Link href="/admin/trips" className="text-sm text-cobalt underline">
          ← {t("trips.title")}
        </Link>
      </p>
      <PageHeader
        title={trip.title || t("trips.untitled")}
        actions={
          <a href={`/${siteLocale}/trip-builder?trip=${snap.id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-semibold text-white hover:bg-cobalt">
            {t("trips.openBuilder")} ↗
          </a>
        }
      >
        <p className="mt-1 text-ink-muted">
          {snap.id} · {snap.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {snap.locale.toUpperCase()}
        </p>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("trips.total")} value={usd(budget.totalUsd)} hint={t("trips.perPerson", { price: usd(budget.perPersonUsd) })} />
        <StatTile label={t("trips.dates")} value={trip.startDate ? `${trip.startDate.slice(5)} → ${(trip.endDate ?? "").slice(5)}` : "—"} hint={t("trips.days", { count: budget.days })} />
        <StatTile label={t("trips.travellers")} value={t("trips.pax", { adults: trip.adults, children: trip.children })} />
        <StatTile label={t("trips.destinations")} value={String(trip.destinations.length)} hint={trip.destinations.map((d) => name.get(d) ?? d).join(", ")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("trips.itinerary")} className="lg:col-span-2">
          {items.length === 0 && <p className="text-ink-muted">{t("trips.noItems")}</p>}
          <div className="space-y-5">
            {days.map((d) => (
              <div key={d}>
                <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-cobalt">{d ? t("trips.dayN", { day: d }) : t("trips.unscheduled")}</h3>
                <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
                  {items
                    .filter((i) => (i.day && i.day <= budget.days ? i.day : 0) === d)
                    .map((i) => {
                      const href = itemHref(i);
                      return (
                        <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                          <span className="min-w-0">
                            <span className="mr-2 rounded-sm bg-sand-soft px-1.5 py-0.5 text-xs font-semibold text-ink-muted">{t(`trips.kind.${i.kind}` as "trips.kind.hotel")}</span>
                            {href ? (
                              <a href={`/${siteLocale}${href}`} target="_blank" rel="noopener" className="font-semibold text-lapis underline">
                                {i.title}
                              </a>
                            ) : (
                              <span className="font-semibold">{i.title}</span>
                            )}
                            {i.meta && <span className="block text-xs text-ink-muted">{i.meta}</span>}
                          </span>
                          <span className="whitespace-nowrap text-sm text-ink-muted">{i.priceUsd ? `${usd(i.priceUsd)} ${unit(i.priceUnit)}` : "—"}</span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title={t("trips.budget")}>
            <HBars rows={BUDGET_CATEGORIES.filter((c) => budget.byCategory[c] > 0).map((c) => ({ label: t(`trips.cat.${c}`), value: budget.byCategory[c], display: usd(budget.byCategory[c]) }))} />
            <p className="mt-3 text-xs text-ink-muted">{snap.includeMeals ? t("trips.withMeals") : t("trips.withoutMeals")}</p>
          </Panel>
          <Panel title={t("trips.requests")}>
            {(requests.get(snap.id) ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">{t("trips.noRequests")}</p>
            ) : (
              <ul className="space-y-2">
                {(requests.get(snap.id) ?? []).map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/requests/${r.id}`} className="font-semibold text-cobalt underline">
                      {r.reference}
                    </Link>
                    <span className="text-sm text-ink-muted">
                      {" "}
                      · {r.fullName} · {r.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
