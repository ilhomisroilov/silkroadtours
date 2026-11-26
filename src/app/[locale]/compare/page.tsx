import { ArrowRight, Check, Minus, Star } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { ComparePicker } from "@/components/compare/compare-picker";
import { getPublishedTourBySlug, listPublishedTours, priceTable } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { formatDateLabel } from "@/lib/format";
import { localize } from "@/lib/localize";
import { formatMoney } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/compare", title: t("nt.compare.title"), description: t("nt.compare.lead"), noIndex: true });
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tours?: string }>;
}) {
  const { locale } = await params;
  const { tours: raw } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [rates, currency] = await Promise.all([exchangeRates(), requestCurrency(locale)]);
  const slugs = [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{2,120}$/.test(s)))].slice(0, 3);
  const [all, found] = await Promise.all([
    listPublishedTours(db(), { currency, sort: "featured", page: 1, pageSize: 500 }, rates),
    Promise.all(slugs.map((s) => getPublishedTourBySlug(db(), s))),
  ]);
  const tours = found.filter((x): x is NonNullable<typeof x> => !!x);

  const fromOf = (tour: (typeof tours)[number]) => {
    try {
      const rows = priceTable(tour, currency, rates);
      const min = rows.reduce<number | null>((m, r) => (m == null || r.amountMinor < m ? r.amountMinor : m), null);
      return min == null ? t("nt.compare.onRequest") : formatMoney(min, currency, locale);
    } catch {
      return t("nt.compare.onRequest");
    }
  };
  const lang = (l: string) => (t.has(`services.guideLanguages.${l}` as never) ? t(`services.guideLanguages.${l}` as never) : l.toUpperCase());
  const List = ({ items, icon }: { items: string[]; icon: "yes" | "no" }) =>
    items.length ? (
      <ul className="space-y-1.5">
        {items.slice(0, 8).map((x) => (
          <li key={x} className="flex gap-2">
            {icon === "yes" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />}
            <span>{x}</span>
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-ink-muted">—</span>
    );

  const rows: { label: string; cell: (tour: (typeof tours)[number]) => ReactNode }[] = [
    { label: t("nt.compare.price"), cell: (x) => <span className="text-xl font-extrabold text-lapis">{fromOf(x)}</span> },
    { label: t("tour.duration"), cell: (x) => `${t("common.days", { count: x.durationDays })}, ${t("common.nights", { count: x.durationNights })}` },
    { label: t("nt.compare.type"), cell: (x) => `${t(`categories.${x.category}` as never)} · ${t(`audience.${x.audience}Short` as never)}` },
    {
      label: t("nt.compare.places"),
      cell: (x) => {
        const names = x.destinationLinks.length ? x.destinationLinks.map((l) => localize(l.destination.name, locale)) : [localize(x.primaryDestination.name, locale)];
        return names.join(" → ");
      },
    },
    { label: t("difficulty.label"), cell: (x) => t(`difficulty.${x.difficulty}` as never) },
    { label: t("tour.groupSize"), cell: (x) => t("common.groupSize", { min: x.minGroup, max: x.maxGroup }) },
    { label: t("tour.guideLanguages"), cell: (x) => x.guideLanguages.map(lang).join(", ") },
    {
      label: t("tour.season"),
      cell: (x) => (x.seasonMonths.length === 0 || x.seasonMonths.length === 12 ? t("nt.compare.allYear") : x.seasonMonths.map((m) => t(`monthsShort.${m}` as never)).join(", ")),
    },
    { label: t("nt.compare.nextDeparture"), cell: (x) => (x.departures[0] ? formatDateLabel(x.departures[0].startDate, (m) => t(`monthsShort.${m}` as never)) : t("nt.compare.onRequest")) },
    {
      label: t("nt.compare.rating"),
      cell: (x) =>
        x.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold"><Star aria-hidden="true" className="size-4 fill-saffron text-saffron" />{x.ratingAvg.toFixed(1)} · {t("common.reviewsCount", { count: x.ratingCount })}</span>
        ) : (
          <span className="text-ink-muted">{t("nt.compare.noRating")}</span>
        ),
    },
    { label: t("tour.included"), cell: (x) => <List icon="yes" items={x.included.map((i) => localize(i, locale))} /> },
    { label: t("tour.excluded"), cell: (x) => <List icon="no" items={x.excluded.map((i) => localize(i, locale))} /> },
  ];

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.compare.title"), href: "/compare" },
        ]}
        eyebrow={t("nav.tours")}
        title={t("nt.compare.title")}
        lead={t("nt.compare.lead")}
      >
        <div className="mt-8">
          <ComparePicker
            options={all.items.map((x) => ({ slug: x.slug, title: localize(x.title, locale) }))}
            selected={tours.map((x) => x.slug)}
            labels={{ slot: t("nt.compare.slot", { n: "{n}" }), choose: t("nt.compare.choose"), remove: t("nt.compare.remove") }}
          />
        </div>
      </PageHero>
      <div className="container-page py-10">
        {tours.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white p-8 text-center shadow-card">
            <h2 className="text-2xl text-lapis">{t("nt.compare.emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-muted">{t("nt.compare.empty")}</p>
            <Link href="/tours" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
              {t("nt.wishlist.browse")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] bg-white shadow-card">
            <table className="w-full min-w-[44rem] table-fixed border-collapse text-left text-[0.95rem]">
              <caption className="sr-only">{t("nt.compare.title")}</caption>
              <colgroup>
                <col className="w-44" />
                {tours.map((x) => (
                  <col key={x.slug} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <td className="p-4" />
                  {tours.map((x) => {
                    const title = localize(x.title, locale);
                    return (
                      <th key={x.slug} scope="col" className="p-4 align-top font-normal">
                        <Link href={`/tours/${x.slug}`} className="group block">
                          <span className="block aspect-[16/10] overflow-hidden rounded-2xl">
                            <SmartImage src={x.heroImage} alt="" label={title} compact sizes="(min-width: 1024px) 25vw, 40vw" imgClassName="transition-transform duration-700 group-hover:scale-105" />
                          </span>
                          <span className="mt-3 block text-lg font-extrabold leading-snug text-lapis group-hover:text-cobalt">{title}</span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <th scope="row" className="bg-sky/40 p-4 align-top text-sm font-bold text-lapis">{r.label}</th>
                    {tours.map((x) => (
                      <td key={x.slug} className="p-4 align-top text-ink/90">{r.cell(x)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td className="p-4" />
                  {tours.map((x) => (
                    <td key={x.slug} className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/book/${x.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">{t("tour.bookShort")}</Link>
                        <Link href={`/tours/${x.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-bold text-lapis hover:border-cobalt">{t("common.viewTour")}</Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
