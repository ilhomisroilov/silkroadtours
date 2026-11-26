import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusControl, NoteForm, ResendButton } from "@/components/admin/booking-actions";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { getBookingAdmin } from "@/db/queries/bookings";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { adminT, requireAdminPage } from "@/lib/server/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminT();
  return { title: t("bookings.title") };
}

export default async function AdminBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { t, locale } = await adminT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const b = await getBookingAdmin(getDb(), id);
  if (!b) notFound();
  const handle = b.messengerHandle ?? "";
  const links = messengerLinks({
    whatsapp: b.contactChannel === "whatsapp" && /\d{6,}/.test(handle) ? handle : b.phone,
    telegram: b.contactChannel === "telegram" && handle ? handle : "",
    phone: b.phone,
  }, `${b.reference}`);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0"><dt className="text-ink-muted">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>
  );
  return (
    <>
      <p className="mb-2"><Link href="/admin/bookings" className="text-sm text-cobalt underline">← {t("bookings.title")}</Link></p>
      <PageHeader title={t("bookings.detail", { reference: b.reference })} actions={<ResendButton url={`/api/admin/bookings/${b.id}/notify`} />}>
        <div className="mt-2 flex items-center gap-2"><StatusBadge status={b.status} label={t(`status.${b.status}`)} /><span className="text-sm text-ink-muted">{b.telegramNotifiedAt ? t("bookings.notified") : t("bookings.notNotified")}</span></div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("bookings.tour")} className="lg:col-span-2">
          <dl>
            {row(t("bookings.tour"), b.tour ? <Link className="text-lapis underline" href={`/admin/tours/${b.tour.id}`}>{localize(b.tour.title, locale)}</Link> : b.tourTitleSnapshot ?? (b.destination ? localize(b.destination.name, locale) : "—"))}
            {row(t("bookings.type"), `${b.audience} · ${b.bookingType}`)}
            {row(t("bookings.date"), b.preferredDate)}
            {b.departure && row(t("bookings.departure"), <span data-testid="admin-departure-seats">{b.departure.startDate} – {b.departure.endDate} · {t("bookings.seatsLeft", { count: b.departure.seatsTotal - b.departure.seatsBooked })}</span>)}
            {row(t("bookings.pax"), `${b.adults} + ${b.children}`)}
            {row(t("bookings.quote"), b.quoteTotalMinor != null ? formatMoney(b.quoteTotalMinor, b.quoteCurrency, locale) : "—")}
            {row(t("bookings.locale"), b.locale.toUpperCase())}
            {b.utmSource && row(t("bookings.utm"), b.utmSource)}
          </dl>
          {b.specialRequests && (
            <div className="mt-4 rounded-sm bg-sand-soft p-3"><p className="text-sm font-semibold">{t("bookings.requests")}</p><p className="whitespace-pre-wrap">{b.specialRequests}</p></div>
          )}
        </Panel>
        <Panel title={t("bookings.contact")}>
          <dl>
            {row(t("bookings.customer"), b.fullName)}
            {row(t("bookings.email"), <a className="text-lapis underline" href={`mailto:${b.email}`}>{b.email}</a>)}
            {row(t("bookings.call"), b.phone)}
            {row(t("bookings.channel"), `${b.contactChannel}${handle ? ` · ${handle}` : ""}`)}
            {b.country && row(t("bookings.country"), b.country)}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-success px-4 text-sm font-semibold text-white"><MessageCircle aria-hidden="true" className="size-4" />{t("bookings.whatsapp")}</a>}
            {links.telegram && <a href={links.telegram} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cobalt px-4 text-sm font-semibold text-white"><Send aria-hidden="true" className="size-4" />{t("bookings.telegram")}</a>}
            {links.phone && <a href={links.phone} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold"><Phone aria-hidden="true" className="size-4" />{t("bookings.call")}</a>}
            <a href={`mailto:${b.email}?subject=${encodeURIComponent(b.reference)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold"><Mail aria-hidden="true" className="size-4" />{t("bookings.email")}</a>
          </div>
        </Panel>
        <Panel title={t("bookings.changeStatus")}>
          <BookingStatusControl id={b.id} status={b.status} />
        </Panel>
        <Panel title={t("bookings.notes")} className="lg:col-span-2">
          <NoteForm url={`/api/admin/bookings/${b.id}/notes`} />
          <ol className="mt-5 space-y-3 border-l-2 border-saffron pl-4">
            {b.notes.map((n) => (
              <li key={n.id}>
                <p className="text-xs text-ink-muted">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {n.author?.name ?? "—"}</p>
                {n.kind === "status_change" && n.fromStatus && n.toStatus && (
                  <p className="font-semibold">{t("bookings.statusChanged", { from: t(`status.${n.fromStatus}`), to: t(`status.${n.toStatus}`) })}</p>
                )}
                {n.body && <p className="whitespace-pre-wrap">{n.body}</p>}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
