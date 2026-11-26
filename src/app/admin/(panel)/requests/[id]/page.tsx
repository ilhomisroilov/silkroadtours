import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResendButton } from "@/components/admin/booking-actions";
import { RequestEditor } from "@/components/admin/request-actions";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getServiceRequest } from "@/db/queries/service-requests";
import { messengerLinks } from "@/lib/links";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("requests.title") };
}

export default async function AdminRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t } = await adminT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const r = await getServiceRequest(getDb(), id);
  if (!r) notFound();
  const links = messengerLinks({ whatsapp: r.phone, telegram: r.contactChannel === "telegram" ? r.messengerHandle ?? "" : "", phone: r.phone }, r.reference);
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v));
  return (
    <>
      <p className="mb-2"><Link href="/admin/requests" className="text-sm text-cobalt underline">← {t("requests.title")}</Link></p>
      <PageHeader title={`${r.reference} · ${t(`requests.types.${r.type}`)}`} actions={<ResendButton url={`/api/admin/service-requests/${r.id}/notify`} />}>
        <div className="mt-2"><StatusBadge status={r.status} label={t(`status.${r.status}`)} /></div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("requests.details")} className="lg:col-span-2">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {Object.entries(r.payload).map(([k, v]) => (
              <div key={k} className="border-b border-line py-2"><dt className="text-xs uppercase tracking-wide text-ink-muted">{k}</dt><dd className="font-semibold">{show(v)}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title={t("bookings.contact")}>
          <p className="font-semibold">{r.fullName}</p>
          <p><a href={`mailto:${r.email}`} className="text-lapis underline">{r.email}</a></p>
          <p>{r.phone} · {r.contactChannel}{r.messengerHandle ? ` · ${r.messengerHandle}` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full bg-success px-4 text-sm font-semibold text-white">{t("bookings.whatsapp")}</a>}
            {links.telegram && <a href={links.telegram} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full bg-cobalt px-4 text-sm font-semibold text-white">{t("bookings.telegram")}</a>}
            {links.phone && <a href={links.phone} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold">{t("bookings.call")}</a>}
          </div>
          <div className="mt-6"><RequestEditor id={r.id} status={r.status} notes={r.internalNotes ?? ""} /></div>
        </Panel>
      </div>
    </>
  );
}
