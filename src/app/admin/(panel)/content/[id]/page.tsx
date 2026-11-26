import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/admin/content-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getContentById } from "@/db/queries/content";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { contentEditorOptions } from "@/lib/server/content-editor-data";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("content.edit") };
}

export default async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const c = await getContentById(getDb(), id);
  if (!c) notFound();
  const opts = await contentEditorOptions(getDb(), c.kind);
  return (
    <>
      <p className="mb-2"><Link href={`/admin/content?kind=${c.kind}`} className="text-sm text-cobalt underline">← {t(`content.kinds.${c.kind}`)}</Link></p>
      <PageHeader title={c.title.en}><p className="text-ink-muted">{t(`content.kinds.${c.kind}`)} · /{c.slug}</p></PageHeader>
      <ContentEditor
        {...opts}
        initial={{ id: c.id, kind: c.kind, slug: c.slug, category: c.category, title: c.title, excerpt: c.excerpt, body: c.body, image: c.image, destinationSlug: c.destinationSlug, icon: c.icon, requestType: c.requestType, durationHours: c.durationHours, priceFromUsd: c.priceFromUsd, readingMinutes: c.readingMinutes, isPublished: c.isPublished, sortOrder: c.sortOrder }}
      />
    </>
  );
}
