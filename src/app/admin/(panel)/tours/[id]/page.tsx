import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TourEditor } from "@/components/admin/tour-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listDestinationsAdmin } from "@/db/queries/destinations";
import { getRates } from "@/db/queries/settings";
import { getTourAdmin } from "@/db/queries/tours";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { toEditorData } from "@/lib/server/tour-editor-data";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("tours.title") };
}

export default async function AdminTourEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const db = getDb();
  const [tour, destinations, rates] = await Promise.all([getTourAdmin(db, id), listDestinationsAdmin(db), getRates(db)]);
  if (!tour) notFound();
  const data = toEditorData(tour);
  return (
    <>
      <p className="mb-2"><Link href="/admin/tours" className="text-sm text-cobalt underline">← {t("tours.title")}</Link></p>
      <PageHeader
        title={localize(tour.title, locale)}
        actions={tour.isPublished ? <a href={`/${locale === "uz" ? "uz" : "en"}/tours/${tour.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 font-semibold">{t("nav.viewSite")} ↗</a> : undefined}
      />
      <TourEditor
        key={tour.id}
        initial={data.tour}
        itinerary={data.days}
        tiers={data.tiers}
        departures={data.departures}
        destinations={destinations.map((d) => ({ id: d.id, name: localize(d.name, locale) }))}
        rates={rates}
      />
    </>
  );
}
