import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput } from "@/components/admin/list-tools";
import { TourRowActions } from "@/components/admin/tour-row-actions";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { listToursAdmin } from "@/db/queries/tours";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { adminListQuerySchema } from "@/validators/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("tours.title") };
}

export default async function AdminTours({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = adminListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : {};
  const tours = await listToursAdmin(getDb(), q);
  return (
    <>
      <PageHeader title={t("tours.title")} actions={<Link href="/admin/tours/new" className={buttonVariants()}>+ {t("tours.new")}</Link>}>
        <p className="text-ink-muted">{t("common.total", { count: tours.length })}</p>
      </PageHeader>
      <FilterBar submitLabel={t("common.filter")}>
        <FilterField label={t("common.search")}><input name="q" defaultValue={q.q ?? ""} className={`${filterInput} w-56`} /></FilterField>
        <FilterField label={t("tours.audience")}>
          <select name="audience" defaultValue={q.audience ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            <option value="inbound">inbound</option>
            <option value="domestic">domestic</option>
          </select>
        </FilterField>
        <FilterField label={t("common.published")}>
          <select name="published" defaultValue={q.published ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            <option value="true">{t("common.published")}</option>
            <option value="false">{t("common.draft")}</option>
          </select>
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("tours.titleField")}</th>
              <th className={tableCls.th}>{t("tours.audience")}</th>
              <th className={tableCls.th}>{t("tours.durationDays")}</th>
              <th className={tableCls.th}>{t("bookings.quote")}</th>
              <th className={tableCls.th}>{t("bookings.status")}</th>
              <th className={tableCls.th}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((tour) => (
              <tr key={tour.id} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}>
                  <Link href={`/admin/tours/${tour.id}`} className="font-bold text-lapis underline">{localize(tour.title, locale)}</Link>
                  <div className="text-xs text-ink-muted">/{tour.slug} · {localize(tour.destination.name, locale)} · {t("tours.bookings", { count: tour.bookingCount })}</div>
                </td>
                <td className={tableCls.td}>{tour.audience}</td>
                <td className={tableCls.td}>{tour.durationDays}</td>
                <td className={tableCls.td}>{tour.fromPriceMinor ? formatMoney(tour.fromPriceMinor, tour.baseCurrency, locale) : "—"}</td>
                <td className={tableCls.td}>
                  <span className={tour.isPublished ? "font-semibold text-success" : "text-ink-muted"}>{tour.isPublished ? t("common.published") : t("common.draft")}</span>
                  {tour.isFeatured && <div className="text-xs text-saffron-ink">★ {t("tours.featured")}</div>}
                </td>
                <td className={tableCls.td}><TourRowActions id={tour.id} isPublished={tour.isPublished} bookingCount={tour.bookingCount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
