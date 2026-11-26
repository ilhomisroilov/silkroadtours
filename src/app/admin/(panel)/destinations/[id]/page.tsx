import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DestinationEditor, type EditorDestination } from "@/components/admin/destination-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getDestinationAdmin } from "@/db/queries/destinations";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("destinations.title") };
}

/** /admin/destinations/new creates one; /admin/destinations/[id] edits it. */
export default async function AdminDestinationEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const { id: raw } = await params;
  const empty = { en: "", uz: "", ru: "" };
  let initial: EditorDestination;
  if (raw === "new") {
    initial = { slug: "", name: { ...empty }, tagline: { ...empty }, overview: { ...empty }, attractions: [], bestTime: { ...empty }, bestMonths: [], lat: 40.1, lng: 67.8, heroImage: "/images/destinations/new/hero.jpg", gallery: [], seoTitle: null, seoDescription: null, sortOrder: 100, isPublished: false };
  } else {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) notFound();
    const d = await getDestinationAdmin(getDb(), id);
    if (!d) notFound();
    initial = { id: d.id, slug: d.slug, name: d.name, tagline: d.tagline, overview: d.overview, attractions: d.attractions, bestTime: d.bestTime, bestMonths: d.bestMonths, lat: d.lat, lng: d.lng, heroImage: d.heroImage, gallery: d.gallery, seoTitle: d.seoTitle, seoDescription: d.seoDescription, sortOrder: d.sortOrder, isPublished: d.isPublished };
  }
  return (
    <>
      <p className="mb-2"><Link href="/admin/destinations" className="text-sm text-cobalt underline">← {t("destinations.title")}</Link></p>
      <PageHeader title={initial.id ? localize(initial.name, locale) : t("destinations.new")} />
      <DestinationEditor key={raw} initial={initial} />
    </>
  );
}
