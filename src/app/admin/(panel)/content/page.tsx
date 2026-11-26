import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput } from "@/components/admin/list-tools";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { contentCounts, listContentAdmin } from "@/db/queries/content";
import { CONTENT_KINDS } from "@/db/schema";
import { imageExists } from "@/lib/images";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { contentListQuerySchema } from "@/validators/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("content.title") };
}

export default async function AdminContent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = contentListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : contentListQuerySchema.parse({});
  const [items, counts] = await Promise.all([listContentAdmin(getDb(), q.kind, q.q), contentCounts(getDb())]);
  return (
    <>
      <PageHeader
        title={t("content.title")}
        actions={<Link href={`/admin/content/new?kind=${q.kind}`} className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 font-semibold text-white hover:bg-lapis-deep">+ {t("content.new")}</Link>}
      />
      <nav aria-label={t("content.title")} className="mb-4 flex flex-wrap gap-2">
        {CONTENT_KINDS.map((k) => (
          <Link
            key={k}
            href={`/admin/content?kind=${k}`}
            aria-current={k === q.kind ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${k === q.kind ? "bg-lapis text-white" : "border border-line bg-white text-ink hover:bg-sand-soft"}`}
          >
            {t(`content.kinds.${k}`)} <span className="rounded-full bg-black/10 px-2 text-xs">{counts[k]}</span>
          </Link>
        ))}
      </nav>
      <FilterBar submitLabel={t("common.search")}>
        <input type="hidden" name="kind" value={q.kind} />
        <FilterField label={t("content.search")}>
          <input name="q" type="search" defaultValue={q.q ?? ""} className={`${filterInput} w-72 max-w-full`} />
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table} data-testid="content-table">
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("content.titleField")}</th>
              <th className={tableCls.th}>{t("content.category")}</th>
              <th className={tableCls.th}>{t("bookings.status")}</th>
              <th className={tableCls.th}>{t("content.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} className={`${tableCls.td} text-center text-ink-muted`}>{t("common.empty")}</td></tr>}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-sm bg-sand-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                      {imageExists(c.image) && <img src={c.image!} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <Link className="font-bold text-lapis underline" href={`/admin/content/${c.id}`}>{c.title.en}</Link>
                      <div className="text-xs text-ink-muted">/{c.slug}</div>
                    </div>
                  </div>
                </td>
                <td className={tableCls.td}>{c.category ?? "—"}</td>
                <td className={tableCls.td}>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.isPublished ? "bg-success/10 text-success" : "bg-saffron-soft text-saffron-ink"}`}>{c.isPublished ? t("common.published") : t("common.draft")}</span>
                </td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{c.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
