import type { Metadata } from "next";
import Link from "next/link";
import { TourEditor, type EditorTour } from "@/components/admin/tour-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listDestinationsAdmin } from "@/db/queries/destinations";
import { getRates } from "@/db/queries/settings";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("tours.new") };
}

export default async function AdminTourNew() {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const db = getDb();
  const [destinations, rates] = await Promise.all([listDestinationsAdmin(db), getRates(db)]);
  const empty = { en: "", uz: "", ru: "" };
  const initial: EditorTour = {
    slug: "",
    audience: "inbound",
    category: "cultural",
    primaryDestinationId: destinations[0]?.id ?? 1,
    destinationIds: [],
    title: { ...empty },
    summary: { ...empty },
    description: { ...empty },
    durationDays: 1,
    durationNights: 0,
    difficulty: "easy",
    minGroup: 1,
    maxGroup: 12,
    baseCurrency: "USD",
    childPricePercent: 70,
    compareAtPriceMinor: null,
    badges: [],
    included: [],
    excluded: [],
    accommodation: [],
    transport: [],
    route: [],
    guideLanguages: ["en", "ru", "uz"],
    seasonMonths: [],
    heroImage: "/images/tours/new-tour.jpg",
    gallery: [],
    seoTitle: null,
    seoDescription: null,
    isFeatured: false,
    isPublished: false,
    sortOrder: 100,
  };
  return (
    <>
      <p className="mb-2"><Link href="/admin/tours" className="text-sm text-cobalt underline">← {t("tours.title")}</Link></p>
      <PageHeader title={t("tours.new")} />
      <TourEditor initial={initial} itinerary={[]} tiers={[]} departures={[]} destinations={destinations.map((d) => ({ id: d.id, name: localize(d.name, locale) }))} rates={rates} />
    </>
  );
}
