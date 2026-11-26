import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterBar, FilterField, filterInput } from "@/components/admin/list-tools";
import { DeletePlaceButton, PublishToggle, SortOrderInput } from "@/components/admin/places/place-actions";
import { PageHeader, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { listPlacesAdmin, placeCounts, placeEditorOptions } from "@/db/queries/admin-places";
import { PLACE_KINDS, PLACE_SOURCES, type PlaceSource } from "@/db/types";
import { imageExists } from "@/lib/images";
import { localize } from "@/lib/localize";
import { adminT, requireAdminPage } from "@/lib/server/admin";
import { placeListQuerySchema } from "@/validators/place";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("places.title") };
}

const SOURCE_CLS: Record<PlaceSource, string> = {
  seed: "bg-sand text-ink",
  admin: "bg-lapis/10 text-lapis",
  partner: "bg-turquoise-ink/10 text-turquoise-ink",
};

export default async function AdminPlaces({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v));
  const parsed = placeListQuerySchema.safeParse(raw);
  const q = parsed.success ? parsed.data : placeListQuerySchema.parse({});
  const db = getDb();
  const [rows, counts, opts] = await Promise.all([listPlacesAdmin(db, q), placeCounts(db), placeEditorOptions(db)]);
  const destName = new Map(opts.destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const filtered = Boolean(q.destination || q.q || q.published || q.source);
  return (
    <>
      <PageHeader
        title={t("places.title")}
        actions={
          <Link href={`/admin/places/new?kind=${q.kind}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lapis px-5 font-semibold text-white hover:bg-lapis-deep" data-testid="place-new">
            <Plus aria-hidden="true" className="size-4" /> {t(`places.new.${q.kind}`)}
          </Link>
        }
      >
        <p className="mt-1 max-w-2xl text-ink-muted">{t("places.intro")}</p>
      </PageHeader>

      <nav aria-label={t("places.title")} className="mb-4 flex flex-wrap gap-2">
        {PLACE_KINDS.map((k) => (
          <Link
            key={k}
            href={`/admin/places?kind=${k}`}
            aria-current={k === q.kind ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${k === q.kind ? "bg-lapis text-white" : "border border-line bg-white text-ink hover:bg-sand-soft"}`}
          >
            {t(`places.kinds.${k}`)} <span className={`rounded-full px-2 text-xs ${k === q.kind ? "bg-white/20" : "bg-sand-soft"}`}>{counts[k]}</span>
          </Link>
        ))}
      </nav>

      <FilterBar submitLabel={t("common.filter")}>
        <input type="hidden" name="kind" value={q.kind} />
        <FilterField label={t("places.filters.search")}>
          <input name="q" type="search" defaultValue={q.q ?? ""} className={`${filterInput} w-64 max-w-full`} />
        </FilterField>
        <FilterField label={t("places.filters.destination")}>
          <select name="destination" defaultValue={q.destination ?? ""} className={`${filterInput} max-w-full`}>
            <option value="">{t("places.filters.anyDestination")}</option>
            {opts.destinations.map((d) => <option key={d.slug} value={d.slug}>{localize(d.name, locale)}</option>)}
          </select>
        </FilterField>
        <FilterField label={t("places.filters.status")}>
          <select name="published" defaultValue={q.published ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            <option value="true">{t("places.statusPublished")}</option>
            <option value="false">{t("places.statusHidden")}</option>
          </select>
        </FilterField>
        <FilterField label={t("places.filters.source")}>
          <select name="source" defaultValue={q.source ?? ""} className={filterInput}>
            <option value="">{t("common.all")}</option>
            {PLACE_SOURCES.map((s) => <option key={s} value={s}>{t(`places.sources.${s}`)}</option>)}
          </select>
        </FilterField>
        {filtered && <Link href={`/admin/places?kind=${q.kind}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-cobalt underline">{t("places.filters.reset")}</Link>}
      </FilterBar>

      <p className="mb-2 text-sm text-ink-muted" aria-live="polite">{t("places.count", { count: rows.length })}</p>

      {/* Cards on phones, table from md up. */}
      <ul className="space-y-3 md:hidden" data-testid="places-cards">
        {rows.length === 0 && <li className="rounded-sm border border-line bg-white p-4 text-center text-ink-muted">{t("places.empty")}</li>}
        {rows.map((p) => (
          <li key={p.id} className="rounded-sm border border-line bg-white p-3 shadow-sm">
            <div className="flex gap-3">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-sm bg-sand-soft">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                {imageExists(p.image) && <img src={p.image!} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/places/${p.id}`} className="font-bold text-lapis underline">{localize(p.name, locale)}</Link>
                <p className="truncate text-xs text-ink-muted">{p.destinationSlug ? destName.get(p.destinationSlug) ?? p.destinationSlug : t("places.noDestination")}{p.priceFromUsd != null ? ` · ${t("places.fromPrice", { price: p.priceFromUsd })}` : ""}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${SOURCE_CLS[p.source]}`}>{t(`places.sources.${p.source}`)}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <PublishToggle id={p.id} isPublished={p.isPublished} />
              <div className="flex items-center gap-1">
                <SortOrderInput id={p.id} value={p.sortOrder} label={`${t("places.cols.order")}: ${localize(p.name, locale)}`} />
                <DeletePlaceButton id={p.id} name={localize(p.name, locale)} compact />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className={`${tableCls.wrap} hidden md:block`}>
        <table className={tableCls.table} data-testid="places-table">
          <thead className={tableCls.thead}>
            <tr>
              <th className={tableCls.th}>{t("places.cols.name")}</th>
              <th className={tableCls.th}>{t("places.cols.destination")}</th>
              <th className={`${tableCls.th} text-right`}>{t("places.cols.price")}</th>
              <th className={tableCls.th}>{t("places.cols.source")}</th>
              <th className={tableCls.th}>{t("places.cols.status")}</th>
              <th className={tableCls.th}>{t("places.cols.order")}</th>
              <th className={`${tableCls.th} relative`}><span className="sr-only">{t("common.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className={`${tableCls.td} py-8 text-center text-ink-muted`}>{t("places.empty")}</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-sand-soft/40">
                <td className={tableCls.td}>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-sm bg-sand-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                      {imageExists(p.image) && <img src={p.image!} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <Link className="font-bold text-lapis underline" href={`/admin/places/${p.id}`}>{localize(p.name, locale)}</Link>
                      <div className="font-mono text-xs text-ink-muted">{p.slug}</div>
                      {p.partnerName && <div className="text-xs text-ink-muted">{t("places.partnerLabel", { name: p.partnerName })}</div>}
                    </div>
                  </div>
                </td>
                <td className={tableCls.td}>{p.destinationSlug ? destName.get(p.destinationSlug) ?? p.destinationSlug : <span className="text-ink-muted">{t("places.noDestination")}</span>}</td>
                <td className={`${tableCls.td} whitespace-nowrap text-right tabular-nums`}>
                  {p.priceFromUsd != null ? t("places.fromPrice", { price: p.priceFromUsd }) : "—"}
                  {p.priceLevel ? <div className="text-xs text-ink-muted">{"$".repeat(p.priceLevel)}</div> : null}
                </td>
                <td className={tableCls.td}><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${SOURCE_CLS[p.source]}`}>{t(`places.sources.${p.source}`)}</span></td>
                <td className={tableCls.td}><PublishToggle id={p.id} isPublished={p.isPublished} /></td>
                <td className={tableCls.td}><SortOrderInput id={p.id} value={p.sortOrder} label={`${t("places.cols.order")}: ${localize(p.name, locale)}`} /></td>
                <td className={`${tableCls.td} whitespace-nowrap`}>
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/places/${p.id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-lapis hover:bg-lapis/8">{t("places.edit")}</Link>
                    <DeletePlaceButton id={p.id} name={localize(p.name, locale)} compact />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
