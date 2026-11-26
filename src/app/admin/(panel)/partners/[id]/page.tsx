import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyField, PartnerEditor, PartnerReviewPanel, PartnerStatusBadge, PlaceLinker, UnlinkPlaceButton } from "@/components/admin/partners/partner-actions";
import { PageHeader, Panel, StatTile, StatusBadge, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { findAdminById } from "@/db/queries/admin-users";
import { listPublishedDestinations } from "@/db/queries/destinations";
import {
  getPartner,
  listAllPlacesBrief,
  listPartnerPlaces,
  partnerApplicationLead,
  partnerInquiries,
  partnerLeadStats,
  publicSlugOf,
} from "@/db/queries/partners";
import type { BookingStatus } from "@/db/types";
import { localize } from "@/lib/localize";
import { parseServices } from "@/lib/partners";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await adminT();
  const id = Number((await params).id);
  const p = Number.isInteger(id) && id > 0 ? await getPartner(getDb(), id) : null;
  return { title: p ? `${p.businessName} · ${t("partners.title")}` : t("partners.title") };
}

const stamp = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export default async function AdminPartnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { t, locale } = await adminT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const db = getDb();
  const partner = await getPartner(db, id);
  if (!partner) notFound();
  const canEdit = admin.role === "owner";
  const placeList = await listPartnerPlaces(db, partner.id);
  const [inquiries, leads, appLead, reviewer, allPlaces, destinations, publicSlug] = await Promise.all([
    partnerInquiries(db, partner, placeList, 20),
    partnerLeadStats(db, partner, placeList),
    partnerApplicationLead(db, partner.reference),
    partner.reviewedBy ? findAdminById(db, partner.reviewedBy) : Promise.resolve(null),
    listAllPlacesBrief(db),
    listPublishedDestinations(db),
    partner.status === "approved" ? publicSlugOf(db, partner.id) : Promise.resolve(null),
  ]);
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const services = parseServices(partner.services);
  const kindLabel = (k: string) => t(`partners.kinds.${k}`);
  const linkOptions = allPlaces
    .filter((p) => p.partnerId !== partner.id)
    .map((p) => ({
      id: p.id,
      label: `${kindLabel(p.kind)} · ${localize(p.name, locale)}${p.destinationSlug ? ` · ${destName.get(p.destinationSlug) ?? p.destinationSlug}` : ""}`,
      linkedElsewhere: p.partnerId != null,
    }));
  const dashboardPath = `/${partner.locale}/partners/dashboard?ref=${encodeURIComponent(partner.reference)}&token=${encodeURIComponent(partner.token)}`;
  const stage = (s: string) => (t.has(`crm.stages.${s}`) ? t(`crm.stages.${s}`) : s.replace(/_/g, " "));
  const info: [string, string | null][] = [
    [t("partners.reference"), partner.reference],
    [t("partners.type"), t(`partners.types.${partner.type}`)],
    [t("partners.contactName"), partner.contactName],
    [t("partners.email"), partner.email],
    [t("partners.phone"), partner.phone],
    [t("partners.website"), partner.website],
    [t("partners.destination"), partner.destinationSlug ? (destName.get(partner.destinationSlug) ?? partner.destinationSlug) : t("partners.noDestination")],
    [t("partners.city"), partner.city],
    [t("partners.locale"), partner.locale.toUpperCase()],
    [t("partners.source"), t(`partners.sources.${partner.source}`)],
    [t("partners.created"), stamp(partner.createdAt)],
    [t("partners.updated"), stamp(partner.updatedAt)],
  ];

  return (
    <>
      <p className="mb-2">
        <Link href="/admin/partners" className="text-sm text-cobalt underline">← {t("partners.back")}</Link>
      </p>
      <PageHeader
        title={partner.businessName}
        actions={
          publicSlug ? (
            <a href={`/${locale === "uz" ? "uz" : "en"}/partners/${publicSlug}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold hover:bg-sand-soft">
              {t("partners.publicProfile")} ↗
            </a>
          ) : undefined
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <PartnerStatusBadge status={partner.status} label={t(`partners.statuses.${partner.status}`)} />
          <span>{partner.reference}</span>
          <span>·</span>
          <span>{t(`partners.types.${partner.type}`)}</span>
        </div>
      </PageHeader>

      {!canEdit && <p className="mb-4 rounded-sm border-l-4 border-saffron bg-saffron-soft p-3 text-sm font-semibold text-saffron-ink" role="note">{t("partners.readOnly")}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label={t("partners.inquiriesTotal")} value={String(inquiries.total)} />
        <StatTile label={t("partners.inquiries30")} value={String(inquiries.last30)} />
        <StatTile label={t("partners.leadsTotal")} value={String(leads.total)} />
        <StatTile label={t("partners.leadsWon")} value={String(leads.won)} />
        <StatTile label={t("partners.pipelineValue")} value={`$${leads.valueUsd.toLocaleString("en-US")}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Panel title={t("partners.businessInfo")}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k} className="border-b border-line py-2">
                  <dt className="text-xs uppercase tracking-wide text-ink-muted">{k}</dt>
                  <dd className="break-words font-semibold">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("partners.description")}</h3>
            <p className="mt-1 whitespace-pre-line">{partner.description}</p>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("partners.services")}</h3>
            <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
              {services.map((s, i) => (
                <li key={i} className="flex justify-between gap-4 px-3 py-2 text-sm">
                  <span>{s.name}</span>
                  <span className="shrink-0 font-semibold text-lapis">
                    {s.priceFromUsd != null ? `$${s.priceFromUsd}${s.unit ? ` / ${t(`partners.unitNames.${s.unit}`).toLowerCase()}` : ""}` : t("partners.onRequest")}
                  </span>
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-4">
                <PartnerEditor
                  partner={{
                    id: partner.id,
                    type: partner.type,
                    businessName: partner.businessName,
                    contactName: partner.contactName,
                    email: partner.email,
                    phone: partner.phone,
                    website: partner.website,
                    destinationSlug: partner.destinationSlug,
                    city: partner.city,
                    description: partner.description,
                    services: services.length ? services : [{ name: "", priceFromUsd: null, unit: null }],
                    locale: partner.locale,
                  }}
                  destinations={destinations.filter((d) => !d.country).map((d) => ({ slug: d.slug, name: localize(d.name, locale) }))}
                />
              </div>
            )}
          </Panel>

          <Panel title={t("partners.placesTitle")}>
            <p className="-mt-2 mb-3 text-sm text-ink-muted">{t("partners.placesText")}</p>
            {placeList.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("partners.placesEmpty")}</p>
            ) : (
              <ul className="divide-y divide-line rounded-sm border border-line" data-testid="partner-places">
                {placeList.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="text-xs font-bold uppercase text-ink-muted">{kindLabel(p.kind)}</span>{" "}
                      <span className="font-semibold">{localize(p.name, locale)}</span>
                      {p.destinationSlug && <span className="text-ink-muted"> · {destName.get(p.destinationSlug) ?? p.destinationSlug}</span>}
                      {!p.isPublished && <span className="text-ink-muted"> · {t("partners.unpublished")}</span>}
                    </span>
                    {canEdit && <UnlinkPlaceButton partnerId={partner.id} placeId={p.id} />}
                  </li>
                ))}
              </ul>
            )}
            <PlaceLinker partnerId={partner.id} options={linkOptions} canEdit={canEdit} />
          </Panel>

          <Panel title={t("partners.inquiriesTitle")}>
            {inquiries.items.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("partners.inquiriesEmpty")}</p>
            ) : (
              <div className={tableCls.wrap}>
                <table className={tableCls.table}>
                  <thead className={tableCls.thead}>
                    <tr>
                      <th className={tableCls.th}>{t("partners.colDate")}</th>
                      <th className={tableCls.th}>{t("partners.colRef")}</th>
                      <th className={tableCls.th}>{t("partners.colCustomer")}</th>
                      <th className={tableCls.th}>{t("partners.colSubject")}</th>
                      <th className={tableCls.th}>{t("partners.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.items.map((i) => (
                      <tr key={i.id}>
                        <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{stamp(i.createdAt)}</td>
                        <td className={tableCls.td}><Link href={`/admin/requests/${i.id}`} className="font-bold text-lapis underline">{i.reference}</Link></td>
                        <td className={tableCls.td}>{i.fullName}<div className="text-xs text-ink-muted">{i.email}</div></td>
                        <td className={tableCls.td}>{i.subject ?? "—"}</td>
                        <td className={tableCls.td}><StatusBadge status={i.status as BookingStatus} label={t(`status.${i.status}`)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title={t("partners.review")}>
            <p className="mb-3 text-sm text-ink-muted">
              {partner.reviewedAt
                ? reviewer
                  ? t("partners.reviewedBy", { name: reviewer.name, date: stamp(partner.reviewedAt) })
                  : t("partners.reviewedOn", { date: stamp(partner.reviewedAt) })
                : t("partners.notReviewed")}
            </p>
            <PartnerReviewPanel id={partner.id} status={partner.status} note={partner.adminNote ?? ""} canEdit={canEdit} />
          </Panel>

          <Panel title={t("partners.performance")}>
            <dl className="space-y-2 text-sm">
              {Object.entries(leads.byStage).map(([s, n]) => (
                <div key={s} className="flex justify-between gap-3">
                  <dt className="capitalize text-ink-muted">{stage(s)}</dt>
                  <dd className="font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
            {appLead && <p className="mt-3 text-sm">{t("partners.applicationLead", { id: appLead.id, stage: stage(appLead.stage) })}</p>}
            <Link href="/admin/crm" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-cobalt underline">{t("partners.openCrm")}</Link>
          </Panel>

          <Panel title={t("partners.dashboardLink")}>
            <p className="mb-2 text-sm text-ink-muted">{t("partners.dashboardHint")}</p>
            <CopyField value={dashboardPath} label={t("partners.copy")} copiedLabel={t("partners.copied")} />
          </Panel>
        </div>
      </div>
    </>
  );
}
