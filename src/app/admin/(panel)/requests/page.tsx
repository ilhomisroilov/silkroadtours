import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput, Pager } from "@/components/admin/list-tools";
import { PageHeader, StatusBadge, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listServiceRequests } from "@/db/queries/service-requests";
import { BOOKING_STATUSES, SERVICE_TYPES } from "@/db/types";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { serviceRequestListQuerySchema } from "@/validators/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("requests.title") };
}

export default async function AdminRequests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = serviceRequestListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : serviceRequestListQuerySchema.parse({});
  const list = await listServiceRequests(getDb(), q);
  return (
    <>
      <PageHeader title={t("requests.title")}><p className="text-ink-muted">{t("common.total", { count: list.total })}</p></PageHeader>
      <FilterBar submitLabel={t("common.filter")}>
        <FilterField label={t("requests.type")}>
          <select name="type" defaultValue={q.type ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{t(`requests.types.${s}`)}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("bookings.status")}>
          <select name="status" defaultValue={q.status ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("bookings.reference")}</th>
              <th className={tableCls.th}>{t("requests.type")}</th>
              <th className={tableCls.th}>{t("bookings.customer")}</th>
              <th className={tableCls.th}>{t("bookings.channel")}</th>
              <th className={tableCls.th}>{t("bookings.status")}</th>
              <th className={tableCls.th}>{t("bookings.created")}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && <tr><td colSpan={6} className={`${tableCls.td} text-center text-ink-muted`}>{t("common.empty")}</td></tr>}
            {list.items.map((r) => (
              <tr key={r.id} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}><Link className="font-bold text-lapis underline" href={`/admin/requests/${r.id}`}>{r.reference}</Link></td>
                <td className={tableCls.td}>{t(`requests.types.${r.type}`)}</td>
                <td className={tableCls.td}>{r.fullName}<div className="text-xs text-ink-muted">{r.email}</div></td>
                <td className={tableCls.td}>{r.contactChannel}<div className="text-xs text-ink-muted">{r.phone}</div></td>
                <td className={tableCls.td}><StatusBadge status={r.status} label={t(`status.${r.status}`)} /></td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} base="/admin/requests" params={{ type: q.type, status: q.status }} labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: list.page, pages: Math.max(1, Math.ceil(list.total / list.pageSize)) }) }} />
    </>
  );
}
