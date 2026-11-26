import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput, Pager } from "@/components/admin/list-tools";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listCustomers } from "@/db/queries/customers";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { customerListQuerySchema } from "@/validators/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("customers.title") };
}

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = customerListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : customerListQuerySchema.parse({});
  const list = await listCustomers(getDb(), { q: q.q, page: q.page });
  const date = (d: Date) => d.toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={t("customers.title")}><p className="text-ink-muted">{t("customers.total", { count: list.total })}</p></PageHeader>
      <FilterBar submitLabel={t("common.search")}>
        <FilterField label={t("customers.search")}>
          <input name="q" type="search" defaultValue={q.q ?? ""} className={`${filterInput} w-72 max-w-full`} />
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table} data-testid="customers-table">
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("customers.name")}</th>
              <th className={tableCls.th}>{t("customers.contact")}</th>
              <th className={`${tableCls.th} text-right`}>{t("customers.bookings")}</th>
              <th className={`${tableCls.th} text-right`}>{t("customers.requests")}</th>
              <th className={tableCls.th}>{t("customers.newsletter")}</th>
              <th className={tableCls.th}>{t("customers.lastActivity")}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && <tr><td colSpan={6} className={`${tableCls.td} text-center text-ink-muted`}>{t("common.empty")}</td></tr>}
            {list.items.map((c) => (
              <tr key={c.email} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}>
                  <Link className="font-bold text-lapis underline" href={`/admin/customers/${encodeURIComponent(c.email)}`}>{c.name}</Link>
                  <div className="text-xs text-ink-muted">{c.email}</div>
                </td>
                <td className={tableCls.td}>{c.phone}<div className="text-xs text-ink-muted">{c.channel}{c.country ? ` · ${c.country}` : ""} · {c.locales.join(", ").toUpperCase()}</div></td>
                <td className={`${tableCls.td} text-right font-semibold`}>{c.bookings}</td>
                <td className={`${tableCls.td} text-right font-semibold`}>{c.requests}</td>
                <td className={tableCls.td}>{c.subscribed ? <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">{t("customers.subscribed")}</span> : "—"}</td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{date(c.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} base="/admin/customers" params={{ q: q.q }} labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: list.page, pages: Math.max(1, Math.ceil(list.total / list.pageSize)) }) }} />
    </>
  );
}
