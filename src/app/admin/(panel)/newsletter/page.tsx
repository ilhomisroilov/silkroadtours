import { Download } from "lucide-react";
import type { Metadata } from "next";
import { FilterBar, FilterField, filterInput } from "@/components/admin/list-tools";
import { RemoveSubscriber } from "@/components/admin/newsletter-actions";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listSubscribers } from "@/db/queries/content";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("newsletter.title") };
}

export default async function AdminNewsletter({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const q = ((await searchParams).q ?? "").trim().toLowerCase().slice(0, 100);
  const all = await listSubscribers(getDb(), 5000);
  const rows = q ? all.filter((r) => r.email.toLowerCase().includes(q)) : all;
  return (
    <>
      <PageHeader
        title={t("newsletter.title")}
        actions={
          <a href="/api/admin/newsletter/export" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold text-lapis hover:bg-sand-soft">
            <Download aria-hidden="true" className="size-4" /> {t("newsletter.export")}
          </a>
        }
      >
        <p className="text-ink-muted">{t("common.total", { count: all.length })}</p>
      </PageHeader>
      <FilterBar submitLabel={t("common.search")}>
        <FilterField label={t("newsletter.search")}>
          <input name="q" type="search" defaultValue={q} className={`${filterInput} w-72 max-w-full`} />
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("newsletter.email")}</th>
              <th className={tableCls.th}>{t("newsletter.locale")}</th>
              <th className={tableCls.th}>{t("newsletter.source")}</th>
              <th className={tableCls.th}>{t("newsletter.date")}</th>
              <th className={tableCls.th}><span className="sr-only">{t("common.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className={`${tableCls.td} text-center text-ink-muted`}>{t("common.empty")}</td></tr>}
            {rows.slice(0, 500).map((r) => (
              <tr key={r.id}>
                <td className={tableCls.td}><a className="text-lapis underline" href={`mailto:${r.email}`}>{r.email}</a></td>
                <td className={tableCls.td}>{r.locale.toUpperCase()}</td>
                <td className={tableCls.td}>{r.source ?? "—"}</td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{r.createdAt.toISOString().slice(0, 10)}</td>
                <td className={`${tableCls.td} text-right`}><RemoveSubscriber id={r.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
