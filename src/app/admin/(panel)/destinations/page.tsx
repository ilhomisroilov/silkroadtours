import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/admin/destination-editor";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { listDestinationsAdmin } from "@/db/queries/destinations";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("destinations.title") };
}

export default async function AdminDestinations() {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const rows = await listDestinationsAdmin(getDb());
  return (
    <>
      <PageHeader title={t("destinations.title")} actions={<Link href="/admin/destinations/new" className={buttonVariants()}>+ {t("destinations.new")}</Link>} />
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead className={tableCls.thead}><tr><th className={tableCls.th}>{t("destinations.name")}</th><th className={tableCls.th}>{t("tours.title")}</th><th className={tableCls.th}>{t("bookings.status")}</th><th className={tableCls.th}>{t("common.actions")}</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className={tableCls.td}><Link href={`/admin/destinations/${d.id}`} className="font-bold text-lapis underline">{localize(d.name, locale)}</Link><div className="text-xs text-ink-muted">/{d.slug}</div></td>
                <td className={tableCls.td}>{t("destinations.tours", { count: d.tourCount })}</td>
                <td className={tableCls.td}>{d.isPublished ? t("common.published") : t("common.draft")}</td>
                <td className={tableCls.td}><DeleteButton url={`/api/admin/destinations/${d.id}`} label={t("common.delete")} confirmText={d.tourCount > 0 ? t("destinations.deleteBlocked") : t("common.confirmDelete")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
