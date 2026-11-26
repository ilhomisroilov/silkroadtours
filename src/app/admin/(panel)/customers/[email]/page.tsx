import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel, StatusBadge, tableCls } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getCustomer } from "@/db/queries/customers";
import { listLeadsByEmail } from "@/db/queries/crm";
import { SourceBadge, StageBadge } from "@/components/admin/crm/lead-card";
import { serviceTypeKey, usd } from "@/components/admin/crm/shared";
import { messengerLinks } from "@/lib/links";
import { formatMoney } from "@/lib/pricing";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("customers.profile") };
}

export default async function AdminCustomer({ params }: { params: Promise<{ email: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const email = decodeURIComponent((await params).email);
  if (email.length > 200 || !email.includes("@")) notFound();
  const [c, leads] = await Promise.all([getCustomer(getDb(), email), listLeadsByEmail(getDb(), email)]);
  if (!c) notFound();
  const latest = [...c.bookings, ...c.requests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const first = [...c.bookings, ...c.requests].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const handle = latest?.messengerHandle ?? "";
  const links = latest
    ? messengerLinks({ whatsapp: latest.contactChannel === "whatsapp" && /\d{6,}/.test(handle) ? handle : latest.phone, telegram: latest.contactChannel === "telegram" && handle ? handle : "", phone: latest.phone }, "")
    : null;
  const timeline = [
    ...c.bookings.map((b) => ({ at: b.createdAt, kind: t("customers.booking"), ref: b.reference, href: `/admin/bookings/${b.id}`, what: b.tourTitleSnapshot ?? "—", status: b.status, amount: b.quoteTotalMinor != null ? formatMoney(b.quoteTotalMinor, b.quoteCurrency, locale) : null })),
    ...c.requests.map((r) => ({ at: r.createdAt, kind: t("customers.request"), ref: r.reference, href: `/admin/requests/${r.id}`, what: t(`requests.types.${r.type}`), status: r.status, amount: null })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0"><dt className="text-ink-muted">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>
  );
  return (
    <>
      <p className="mb-2"><Link href="/admin/customers" className="text-sm text-cobalt underline">← {t("customers.title")}</Link></p>
      <PageHeader title={latest?.fullName ?? c.email}><p className="text-ink-muted">{t("customers.profile")}</p></PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("customers.contact")}>
          <dl>
            {row(t("bookings.email"), <a className="text-lapis underline" href={`mailto:${c.email}`}>{c.email}</a>)}
            {latest && row(t("bookings.call"), latest.phone)}
            {latest && row(t("bookings.channel"), latest.contactChannel)}
            {row(t("customers.bookings"), c.bookings.length)}
            {row(t("customers.requests"), c.requests.length)}
            {row(t("customers.newsletter"), c.subscription ? t("customers.subscribed") : "—")}
            {first && row(t("customers.firstSeen"), first.createdAt.toISOString().slice(0, 10))}
          </dl>
          {links && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`mailto:${c.email}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:bg-sand-soft"><Mail aria-hidden="true" className="size-4" /> {t("bookings.email")}</a>
              {links.phone && <a href={links.phone} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:bg-sand-soft"><Phone aria-hidden="true" className="size-4" /> {t("bookings.call")}</a>}
              {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:bg-sand-soft"><MessageCircle aria-hidden="true" className="size-4" /> WhatsApp</a>}
              {links.telegram && <a href={links.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:bg-sand-soft"><Send aria-hidden="true" className="size-4" /> Telegram</a>}
            </div>
          )}
        </Panel>
        <Panel title={t("customers.history")} className="lg:col-span-2">
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>{t("bookings.reference")}</th>
                  <th className={tableCls.th}>{t("bookings.type")}</th>
                  <th className={tableCls.th}>{t("bookings.status")}</th>
                  <th className={tableCls.th}>{t("bookings.created")}</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((e) => (
                  <tr key={e.href}>
                    <td className={tableCls.td}><Link className="font-bold text-lapis underline" href={e.href}>{e.ref}</Link><div className="text-xs text-ink-muted">{e.kind}</div></td>
                    <td className={tableCls.td}>{e.what}{e.amount && <div className="text-xs text-ink-muted">{t("customers.quoted")}: {e.amount}</div>}</td>
                    <td className={tableCls.td}><StatusBadge status={e.status} label={t(`status.${e.status}`)} /></td>
                    <td className={`${tableCls.td} whitespace-nowrap text-xs text-ink-muted`}>{e.at.toISOString().slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
                {timeline.length === 0 && <tr><td colSpan={4} className={`${tableCls.td} text-center text-ink-muted`}>{t("customers.notFound")}</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={t("crm.customer.title")} className="lg:col-span-3">
          {leads.length === 0 ? (
            <p className="text-ink-muted">{t("crm.customer.empty")}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="customer-leads">
              {leads.map((l) => (
                <li key={l.id} className="rounded-sm border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StageBadge stage={l.stage} label={t(`crm.stages.${l.stage}`)} />
                    <SourceBadge source={l.source} label={t(`crm.sources.${l.source}`)} />
                  </div>
                  <Link href={`/admin/crm/${l.id}`} className="mt-2 block font-semibold text-lapis underline-offset-2 hover:underline">{serviceTypeKey(l.title) ? t(`requests.types.${serviceTypeKey(l.title)}`) : l.title}</Link>
                  <p className="text-sm text-ink-muted">{[l.sourceRef, l.valueUsd != null ? usd(l.valueUsd, locale) : null, l.assignedName].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
