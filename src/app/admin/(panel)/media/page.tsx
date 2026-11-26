import type { Metadata } from "next";
import { MediaLibrary } from "@/components/admin/media-library";
import { PageHeader } from "@/components/admin/ui";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { listMediaLibrary } from "@/lib/server/media";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("media.title") };
}

export default async function AdminMedia() {
  await requireAdminPage();
  const { t } = await adminT();
  const items = await listMediaLibrary();
  return (
    <>
      <PageHeader title={t("media.title")} />
      <MediaLibrary items={items.map(({ url, name, folder, uploaded }) => ({ url, name, folder, uploaded }))} />
    </>
  );
}
