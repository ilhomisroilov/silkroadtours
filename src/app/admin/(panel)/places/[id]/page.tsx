import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultDetails } from "@/components/admin/places/defaults";
import { PlaceEditor, type EditorPlace } from "@/components/admin/places/place-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getPlaceAdmin, placeEditorOptions } from "@/db/queries/admin-places";
import { PLACE_KINDS, type PlaceKind } from "@/db/types";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("places.title") };
}

const empty = () => ({ en: "", uz: "", ru: "" });

/** /admin/places/new?kind=hotel creates one; /admin/places/[id] edits it. */
export default async function AdminPlaceEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const [{ id: raw }, sp] = await Promise.all([params, searchParams]);
  const db = getDb();
  const opts = await placeEditorOptions(db);
  let initial: EditorPlace;
  if (raw === "new") {
    const kind: PlaceKind = (PLACE_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as PlaceKind) : "hotel";
    initial = { kind, slug: "", destinationSlug: null, name: empty(), summary: empty(), description: empty(), image: null, gallery: [], lat: null, lng: null, priceFromUsd: null, priceLevel: null, tags: [], partnerId: null, isPublished: false, sortOrder: 0, details: defaultDetails(kind) };
  } else {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) notFound();
    const p = await getPlaceAdmin(db, id);
    if (!p) notFound();
    initial = {
      id: p.id,
      kind: p.kind,
      slug: p.slug,
      destinationSlug: p.destinationSlug,
      name: p.name,
      summary: p.summary,
      description: p.description,
      image: p.image,
      gallery: p.gallery ?? [],
      lat: p.lat,
      lng: p.lng,
      priceFromUsd: p.priceFromUsd,
      priceLevel: p.priceLevel,
      tags: p.tags ?? [],
      partnerId: p.partnerId,
      isPublished: p.isPublished,
      sortOrder: p.sortOrder,
      source: p.source,
      details: { ...defaultDetails(p.kind), ...p.details } as EditorPlace["details"],
    };
  }
  const options = {
    destinations: opts.destinations.map((d) => ({ slug: d.slug, name: localize(d.name, locale), lat: d.lat, lng: d.lng })),
    partners: opts.partners.map((o) => ({ id: o.id, label: `${o.businessName} · ${t(`places.partnerTypes.${o.type}`)}${o.status !== "approved" ? ` (${t(`places.partnerStatus.${o.status}`)})` : ""}` })),
  };
  const title = initial.id ? localize(initial.name, locale) : t(`places.new.${initial.kind}`);
  return (
    <>
      <p className="mb-2">
        <Link href={`/admin/places?kind=${initial.kind}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-cobalt underline">← {t(`places.kinds.${initial.kind}`)}</Link>
      </p>
      <PageHeader title={title}>
        {initial.id && (
          <p className="mt-1 text-sm text-ink-muted">
            {t(`places.kindOne.${initial.kind}`)} · {t(`places.sources.${initial.source ?? "admin"}`)} · <span className="font-mono">{initial.slug}</span>
          </p>
        )}
      </PageHeader>
      <PlaceEditor key={raw} initial={initial} options={options} />
    </>
  );
}
