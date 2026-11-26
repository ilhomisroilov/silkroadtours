import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput, Pager } from "@/components/admin/list-tools";
import { PageHeader, StatusBadge, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listBookings } from "@/db/queries/bookings";
import { BOOKING_STATUSES } from "@/db/types";
import { formatMoney } from "@/lib/pricing";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { getTranslations } from "next-intl/server";
import { bookingListQuerySchema } from "@/validators/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("bookings.title") };
}

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const ta = await getTranslations({ locale, namespace: "audience" });
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = bookingListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : bookingListQuerySchema.parse({});
  const list = await listBookings(getDb(), q);
  const fmtTs = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
  return (
    <>
      <PageHeader title={t("bookings.title")}><p className="text-ink-muted">{t("common.total", { count: list.total })}</p></PageHeader>
      <FilterBar submitLabel={t("common.filter")}>
        <FilterField label={t("common.search")}>
          <input name="q" defaultValue={q.q ?? ""} placeholder={t("bookings.searchPlaceholder")} className={`${filterInput} w-64`} />
        </FilterField>
        <FilterField label={t("bookings.status")}>
          <select name="status" defaultValue={q.status ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("bookings.audience")}>
          <select name="audience" defaultValue={q.audience ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            <option value="inbound">{ta("inboundShort")}</option>
            <option value="domestic">{ta("domesticShort")}</option>
          </select>
        </FilterField>
        <FilterField label={t("common.from")}><input type="date" name="from" defaultValue={q.from ?? ""} className={filterInput} /></FilterField>
        <FilterField label={t("common.to")}><input type="date" name="to" defaultValue={q.to ?? ""} className={filterInput} /></FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table} data-testid="admin-bookings">
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("bookings.reference")}</th>
              <th className={tableCls.th}>{t("bookings.customer")}</th>
              <th className={tableCls.th}>{t("bookings.tour")}</th>
              <th className={tableCls.th}>{t("bookings.date")}</th>
              <th className={tableCls.th}>{t("bookings.pax")}</th>
              <th className={tableCls.th}>{t("bookings.quote")}</th>
              <th className={tableCls.th}>{t("bookings.status")}</th>
              <th className={tableCls.th}>{t("bookings.created")}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && (
              <tr><td colSpan={8} className={`${tableCls.td} text-center text-ink-muted`}>{t("common.empty")}</td></tr>
            )}
            {list.items.map((b) => (
              <tr key={b.id} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}><Link href={`/admin/bookings/${b.id}`} className="font-bold text-lapis underline">{b.reference}</Link></td>
                <td className={tableCls.td}>{b.fullName}<div className="text-xs text-ink-muted">{b.phone}</div></td>
                <td className={tableCls.td}>{b.tourTitleSnapshot ?? "—"}<div className="text-xs text-ink-muted">{b.audience} · {b.bookingType}</div></td>
                <td className={tableCls.td}>{b.preferredDate}</td>
                <td className={tableCls.td}>{b.adults}+{b.children}</td>
                <td className={tableCls.td}>{b.quoteTotalMinor != null ? formatMoney(b.quoteTotalMinor, b.quoteCurrency, locale) : "—"}</td>
                <td className={tableCls.td}><StatusBadge status={b.status} label={t(`status.${b.status}`)} /></td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{fmtTs(b.createdAt)}<div>{b.telegramNotifiedAt ? "✓ Telegram" : "✗ Telegram"}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        base="/admin/bookings"
        params={{ q: q.q, status: q.status, audience: q.audience, from: q.from, to: q.to }}
        labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: list.page, pages: Math.max(1, Math.ceil(list.total / list.pageSize)) }) }}
      />
    </>
  );
}
