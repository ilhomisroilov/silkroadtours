import { MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/common/copy-button";
import { GirihPattern, IkatDivider, SuzaniMedallion } from "@/components/ornament";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getBookingPublic } from "@/db/queries/bookings";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { formatDateLabel } from "@/lib/format";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { isValidReference } from "@/lib/reference";
import { contactSettings, db, pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; reference: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, reference } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return pageMetadata({ locale, href: `/booking/${reference}`, title: t("metaTitle", { reference: reference.toUpperCase() }), noIndex: true });
}

export default async function ConfirmationPage({ params }: Props) {
  const { locale, reference: raw } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const reference = decodeURIComponent(raw).toUpperCase();
  const booking = isValidReference(reference) ? await getBookingPublic(db(), reference) : null;
  if (!booking) {
    return (
      <div className="container-page py-16">
        <EmptyState title={t("confirmation.notFoundTitle")}>{t("confirmation.notFoundText")}</EmptyState>
      </div>
    );
  }
  const contact = await contactSettings();
  const links = messengerLinks(contact, t("confirmation.followUpMessage", { reference }));
  const tripName = booking.tour?.title ? localize(booking.tour.title, locale) : booking.tourTitleSnapshot ?? (booking.destination ? localize(booking.destination.name, locale) : "");
  const ms = (m: number) => t(`monthsShort.${m}` as never);

  return (
    <>
      <section className="on-dark relative overflow-hidden bg-lapis-deep text-ivory">
        <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.3} />
        <div className="container-page relative flex flex-col items-center py-14 text-center">
          <SuzaniMedallion size={110} palette="night" />
          <h1 className="mt-6 text-4xl text-ivory">{t("confirmation.title")}</h1>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-saffron">{t("confirmation.reference")}</p>
          <p className="mt-2 font-display text-5xl font-bold tracking-wide text-ivory" data-testid="booking-reference">{reference}</p>
          <div className="mt-4">
            <CopyButton value={reference} label={t("common.copy")} copiedLabel={t("common.copied")} />
          </div>
        </div>
        <IkatDivider height={12} />
      </section>
      <div className="container-page grid gap-10 py-12 lg:grid-cols-2">
        <section aria-labelledby="trip-details" className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
          <h2 id="trip-details" className="text-2xl text-lapis-deep">{t("confirmation.tripDetails")}</h2>
          <dl className="mt-4 divide-y divide-line">
            {tripName && (
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("booking.summary")}</dt><dd className="text-right font-semibold">{tripName}</dd></div>
            )}
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("confirmation.date")}</dt><dd className="font-semibold">{formatDateLabel(booking.preferredDate, ms)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("confirmation.travellers")}</dt><dd className="font-semibold">{t("common.adultsCount", { count: booking.adults })}, {t("common.childrenCount", { count: booking.children })}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("booking.bookingType")}</dt><dd className="font-semibold">{t(`tour.${booking.bookingType}`)}</dd></div>
            {booking.quoteTotalMinor != null && (
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("confirmation.quote")}</dt><dd className="font-semibold">{formatMoney(booking.quoteTotalMinor, booking.quoteCurrency, locale)}</dd></div>
            )}
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{t("confirmation.status")}</dt><dd className="font-semibold text-turquoise-ink" data-testid="booking-status">{t(`confirmation.statuses.${booking.status}`)}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-ink-muted">{t("confirmation.reviewLater")}</p>
        </section>
        <section aria-labelledby="next-steps">
          <h2 id="next-steps" className="text-2xl text-lapis-deep">{t("confirmation.nextTitle")}</h2>
          <ol className="mt-4 space-y-4">
            {[t("confirmation.next1"), t("confirmation.next2"), t("confirmation.next3")].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-ink">{i + 1}</span>
                <p className="pt-1">{s}</p>
              </li>
            ))}
          </ol>
          {(links.whatsapp || links.telegram || links.phone) && (
            <div className="mt-8 rounded-[var(--radius-card)] bg-sand-soft p-6">
              <h3 className="text-2xl text-lapis-deep">{t("confirmation.followUpTitle")}</h3>
              <p className="mt-1 text-ink-muted">{t("confirmation.followUpText", { reference })}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {links.whatsapp && (
                  <a href={links.whatsapp} target="_blank" rel="noopener" className={buttonVariants({ className: "bg-success hover:bg-success/90" })} data-testid="followup-whatsapp">
                    <MessageCircle aria-hidden="true" /> {t("confirmation.whatsapp")}
                  </a>
                )}
                {links.telegram && (
                  <a href={links.telegram} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })} data-testid="followup-telegram">
                    <Send aria-hidden="true" /> {t("confirmation.telegram")}
                  </a>
                )}
                {links.phone && (
                  <a href={links.phone} className={buttonVariants({ variant: "outline" })}>
                    <Phone aria-hidden="true" /> {t("confirmation.call")}
                  </a>
                )}
              </div>
            </div>
          )}
          <Link href="/tours" className={buttonVariants({ variant: "ghost", className: "mt-6" })}>← {t("nav.tours")}</Link>
        </section>
      </div>
    </>
  );
}
