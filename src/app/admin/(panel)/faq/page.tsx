import type { Metadata } from "next";
import { FaqManager } from "@/components/admin/faq-manager";
import { PageHeader } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listFaq } from "@/db/queries/faq";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("faq.title") };
}

export default async function AdminFaq() {
  await requireAdminPage();
  const { t } = await adminT();
  const items = await listFaq(getDb(), { includeUnpublished: true });
  return (
    <>
      <PageHeader title={t("faq.title")} />
      <FaqManager items={items.map((i) => ({ id: i.id, category: i.category, question: i.question, answer: i.answer, sortOrder: i.sortOrder, isPublished: i.isPublished }))} />
    </>
  );
}
