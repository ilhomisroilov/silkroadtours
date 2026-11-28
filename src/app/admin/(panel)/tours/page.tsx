import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput } from "@/components/admin/list-tools";
import { ToursTable } from "@/components/admin/tour-row-actions";
import { PageHeader } from "@/components/admin/ui";
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
      <ToursTable
        rows={tours.map((tour) => ({
          id: tour.id,
          slug: tour.slug,
          title: localize(tour.title, locale),
          destination: localize(tour.destination.name, locale),
          audience: tour.audience,
          durationDays: tour.durationDays,
          price: tour.fromPriceMinor ? formatMoney(tour.fromPriceMinor, tour.baseCurrency, locale) : "—",
          isPublished: tour.isPublished,
          isFeatured: tour.isFeatured,
          bookingCount: tour.bookingCount,
        }))}
      />
    </>
  );
}
