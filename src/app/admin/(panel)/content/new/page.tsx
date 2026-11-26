import type { Metadata } from "next";
import Link from "next/link";
import { ContentEditor } from "@/components/admin/content-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { CONTENT_KINDS, type ContentKind } from "@/db/schema";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { contentEditorOptions } from "@/lib/server/content-editor-data";

const EMPTY = { en: "", uz: "", ru: "" };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("content.new") };
}

export default async function NewContent({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const k = (await searchParams).kind;
  const kind: ContentKind = (CONTENT_KINDS as readonly string[]).includes(k ?? "") ? (k as ContentKind) : "guide";
  const opts = await contentEditorOptions(getDb(), kind);
  return (
    <>
      <p className="mb-2"><Link href={`/admin/content?kind=${kind}`} className="text-sm text-cobalt underline">← {t(`content.kinds.${kind}`)}</Link></p>
      <PageHeader title={`${t("content.new")} · ${t(`content.kinds.${kind}`)}`} />
      <ContentEditor
        {...opts}
        initial={{ kind, slug: "", category: null, title: { ...EMPTY }, excerpt: { ...EMPTY }, body: { ...EMPTY }, image: null, destinationSlug: null, icon: null, requestType: kind === "service" ? "inquiry" : null, durationHours: null, priceFromUsd: null, readingMinutes: kind === "guide" ? 5 : null, isPublished: false, sortOrder: 100 }}
      />
    </>
  );
}
