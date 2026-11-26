import { CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/booking/booking-form";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { SmartImage } from "@/components/common/smart-image";
import { getPublishedTourBySlug } from "@/db/queries/tours";
import { BOOKING_TYPES, type BookingType, type Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { db, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tour = await getPublishedTourBySlug(db(), slug);
  const t = await getTranslations({ locale, namespace: "booking" });
  return pageMetadata({ locale, href: `/book/${slug}`, title: t("metaTitle", { tour: tour ? localize(tour.title, locale) : "" }), noIndex: true });
}

const int = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export default async function BookPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = await getPublishedTourBySlug(db(), slug);
  if (!tour) notFound();
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale, tour.audience === "domestic" ? "domestic" : undefined);
  const types = BOOKING_TYPES.filter((ty) => tour.priceTiers.some((p) => p.bookingType === ty));
  const type: BookingType = types.includes(sp.type as BookingType) ? (sp.type as BookingType) : (types[0] ?? "group");
  const adults = int(sp.adults, 1, tour.maxGroup, Math.min(tour.maxGroup, Math.max(tour.minGroup, 2)));
  const children = int(sp.children, 0, Math.max(0, tour.maxGroup - adults), 0);
  const title = localize(tour.title, locale);
  const region = localize(tour.primaryDestination.name, locale);

  return (
    <div className="container-page py-10">
      <Breadcrumbs
        label={t("nav.breadcrumb")}
        base={`${siteUrl()}/${locale}`}
        items={[
          { name: t("nav.home"), href: "/" },
          { name: title, href: `/tours/${slug}` },
          { name: t("booking.title"), href: `/book/${slug}` },
        ]}
      />
      <h1 className="mt-6 text-4xl text-lapis-deep">{t("booking.title")}</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ClientMessages namespaces={["booking", "tour", "monthsShort", "errors", "forms"]}>
          <BookingForm
            slug={slug}
            tourTitle={title}
            currency={currency}
            types={types}
            minGroup={tour.minGroup}
            maxGroup={tour.maxGroup}
            departures={tour.departures.map((d) => ({
              id: d.id,
              startDate: d.startDate,
              endDate: d.endDate,
              seatsTotal: d.seatsTotal,
              seatsBooked: d.seatsBooked,
              status: d.status,
              priceModifierPercent: d.priceModifierPercent,
            }))}
            prefill={{ type, adults, children, departureId: sp.departureId ? Number(sp.departureId) : undefined, date: sp.date }}
            utmSource={sp.utm_source?.slice(0, 100)}
          />
        </ClientMessages>
        <aside className="order-first lg:order-none">
          <div className="sticky top-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-card">
            <div className="arch-mask-wide aspect-[16/10] px-3 pt-3">
              <SmartImage src={tour.heroImage} alt="" label={region} compact />
            </div>
            <div className="space-y-2 p-5">
              <p className="font-display text-2xl font-semibold text-lapis-deep">{title}</p>
              <p className="flex items-center gap-2 text-sm"><MapPin aria-hidden="true" className="size-4 text-turquoise-ink" /> {region}</p>
              <p className="flex items-center gap-2 text-sm"><CalendarDays aria-hidden="true" className="size-4 text-turquoise-ink" /> {t("common.days", { count: tour.durationDays })}</p>
              <p className="flex items-center gap-2 text-sm"><Users aria-hidden="true" className="size-4 text-turquoise-ink" /> {t("common.groupSize", { min: tour.minGroup, max: tour.maxGroup })}</p>
              <p className="flex items-start gap-2 border-t border-line pt-3 text-sm text-ink-muted"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-turquoise-ink" /> {t("tour.noPaymentNow")}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
