import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Reveal } from "@/components/common/motion";
import { SectionHeading } from "@/components/common/section";
import { SmartImage } from "@/components/common/smart-image";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { monthRanges } from "@/lib/format";
import { localize } from "@/lib/localize";
import { db, pageMetadata, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "destinations" });
  return pageMetadata({ locale, href: "/destinations", title: t("metaTitle"), description: t("intro") });
}

export default async function DestinationsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const ms = (m: number) => t(`monthsShort.${m}` as never);
  const destinations = await listPublishedDestinations(db());
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        label={t("nav.breadcrumb")}
        base={`${siteUrl()}/${locale}`}
        items={[
          { name: t("nav.home"), href: "/" },
          { name: t("destinations.title"), href: "/destinations" },
        ]}
      />
      <div className="mt-6">
        <SectionHeading as="h1" title={t("destinations.title")} text={t("destinations.intro")} />
      </div>
      <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d, i) => {
          const name = localize(d.name, locale);
          return (
            <Reveal as="li" key={d.slug} delay={(i % 3) * 0.06}>
              <Link href={`/destinations/${d.slug}`} className="group block">
                <div className="arch-mask aspect-[4/5] overflow-hidden">
                  <SmartImage src={d.heroImage} alt="" label={name} priority={i < 3} imgClassName="transition-transform duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                </div>
                <h2 className="mt-4 text-3xl text-lapis-deep group-hover:underline">{name}</h2>
                <p className="mt-1 text-ink-muted">{localize(d.tagline, locale)}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 text-sm font-semibold">
                  <span className="text-turquoise-ink">{t("destinations.toursCount", { count: d.tourCount })}</span>
                  {monthRanges(d.bestMonths, ms) && <span className="text-saffron-ink">{monthRanges(d.bestMonths, ms)}</span>}
                </p>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
