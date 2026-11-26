import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterInput, Pager } from "@/components/admin/list-tools";
import { PartnerStatusBadge } from "@/components/admin/partners/partner-actions";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listPartnersAdmin, partnerStatusCounts } from "@/db/queries/partners";
import { cn } from "@/lib/cn";
import { PARTNER_STATUS_LIST, PARTNER_TYPE_LIST } from "@/lib/partners";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { partnerListQuerySchema } from "@/validators/partner";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("partners.title") };
}

export default async function AdminPartners({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = partnerListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : partnerListQuerySchema.parse({});
  const db = getDb();
  const [list, counts] = await Promise.all([listPartnersAdmin(db, q), partnerStatusCounts(db)]);
  const total = counts.pending + counts.approved + counts.rejected;
  const tile = (active: boolean) =>
    cn("flex min-h-11 flex-col rounded-sm border px-4 py-3 shadow-sm transition", active ? "border-lapis bg-lapis text-white" : "border-line bg-white hover:border-lapis/40");
  const statusHref = (s?: string) => {
    const sp = new URLSearchParams();
    if (s) sp.set("status", s);
    if (q.type) sp.set("type", q.type);
    if (q.q) sp.set("q", q.q);
    const qs = sp.toString();
    return `/admin/partners${qs ? `?${qs}` : ""}`;
  };
  return (
    <>
      <PageHeader title={t("partners.title")}>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("partners.lead")}</p>
      </PageHeader>
      <nav aria-label={t("partners.status")} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href={statusHref()} aria-current={!q.status ? "page" : undefined} className={tile(!q.status)}>
          <span className={cn("text-sm font-semibold", !q.status ? "text-white/80" : "text-ink-muted")}>{t("common.all")}</span>
          <span className="font-display text-2xl font-bold">{total}</span>
        </Link>
        {PARTNER_STATUS_LIST.map((s) => (
          <Link key={s} href={statusHref(s)} aria-current={q.status === s ? "page" : undefined} className={tile(q.status === s)} data-testid={`partners-count-${s}`}>
            <span className={cn("text-sm font-semibold", q.status === s ? "text-white/80" : "text-ink-muted")}>{t(`partners.statuses.${s}`)}</span>
            <span className="font-display text-2xl font-bold">{counts[s]}</span>
          </Link>
        ))}
      </nav>
      <FilterBar submitLabel={t("common.filter")}>
        <FilterField label={t("partners.search")}>
          <input type="search" name="q" defaultValue={q.q ?? ""} placeholder={t("partners.searchPlaceholder")} className={filterInput} />
        </FilterField>
        <FilterField label={t("partners.status")}>
          <select name="status" defaultValue={q.status ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {PARTNER_STATUS_LIST.map((s) => <option key={s} value={s}>{t(`partners.statuses.${s}`)}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("partners.type")}>
          <select name="type" defaultValue={q.type ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {PARTNER_TYPE_LIST.map((ty) => <option key={ty} value={ty}>{t(`partners.types.${ty}`)}</option>)}
          </select>
        </FilterField>
      </FilterBar>
      <div className={tableCls.wrap}>
        <table className={tableCls.table} data-testid="partners-table">
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("partners.business")}</th>
              <th className={tableCls.th}>{t("partners.type")}</th>
              <th className={tableCls.th}>{t("partners.city")}</th>
              <th className={tableCls.th}>{t("partners.status")}</th>
              <th className={`${tableCls.th} text-right`}>{t("partners.services")}</th>
              <th className={`${tableCls.th} text-right`}>{t("partners.places")}</th>
              <th className={tableCls.th}>{t("partners.created")}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && (
              <tr><td colSpan={7} className={`${tableCls.td} text-center text-ink-muted`}>{t("partners.empty")}</td></tr>
            )}
            {list.items.map((p) => (
              <tr key={p.id} className="hover:bg-sand-soft/50">
                <td className={tableCls.td}>
                  <Link className="font-bold text-lapis underline" href={`/admin/partners/${p.id}`}>{p.businessName}</Link>
                  <div className="text-xs text-ink-muted">{p.reference} · {p.contactName} · {p.email}</div>
                </td>
                <td className={tableCls.td}>{t(`partners.types.${p.type}`)}</td>
                <td className={tableCls.td}>{p.city ?? "—"}</td>
                <td className={tableCls.td}><PartnerStatusBadge status={p.status} label={t(`partners.statuses.${p.status}`)} /></td>
                <td className={`${tableCls.td} text-right tabular-nums`}>{p.services.length}</td>
                <td className={`${tableCls.td} text-right tabular-nums`}>{p.placeCount}</td>
                <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{p.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        base="/admin/partners"
        params={{ status: q.status, type: q.type, q: q.q }}
        labels={{ prev: t("common.prev"), next: t("common.next"), page: t("common.page", { page: list.page, pages: Math.max(1, Math.ceil(list.total / list.pageSize)) }) }}
      />
    </>
  );
}
