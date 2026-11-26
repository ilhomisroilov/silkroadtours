import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/common/motion";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { monthRanges } from "@/lib/format";
import { localize } from "@/lib/localize";
import { db, pageMetadata } from "@/lib/server/site";

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
  const groups = [
    { id: "uzbekistan", title: t("nt.menu.uzbekistan"), items: destinations.filter((d) => !d.country) },
    { id: "abroad", title: t("nt.menu.abroad"), items: destinations.filter((d) => d.country) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("destinations.title"), href: "/destinations" },
        ]}
        eyebrow={t("nt.dest.eyebrow")}
        title={t("destinations.title")}
        lead={t("destinations.intro")}
      >
        <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("destinations.title")}>
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-lapis shadow-sm hover:text-cobalt">
              {g.title} <span className="rounded-full bg-sky px-2 text-xs text-cobalt">{g.items.length}</span>
            </a>
          ))}
        </nav>
      </PageHero>
      <div className="container-page space-y-14 py-12">
        {groups.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-24">
            <h2 id={`${g.id}-title`} className="text-2xl text-lapis">{g.title}</h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((d, i) => {
                const name = localize(d.name, locale);
                const months = monthRanges(d.bestMonths, ms);
                return (
                  <Reveal as="li" key={d.slug} delay={(i % 4) * 0.05}>
                    <Link href={`/destinations/${d.slug}`} className="group relative block overflow-hidden rounded-[1.5rem] shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                      <div className="aspect-[4/5]">
                        <SmartImage src={d.heroImage} alt="" label={name} priority={i < 4} imgClassName="transition-transform duration-700 group-hover:scale-105" sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-lapis-deep/90 via-lapis-deep/25 to-transparent" />
                      <span aria-hidden="true" className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-lapis transition group-hover:bg-saffron">
                        <ArrowUpRight className="size-5" />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        {d.country && <p className="text-xs font-bold uppercase tracking-[0.1em] text-saffron">{localize(d.country, locale)}</p>}
                        <h3 className="text-2xl leading-tight text-white">{name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-white/85">{localize(d.tagline, locale)}</p>
                        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/90">
                          <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">{t("destinations.toursCount", { count: d.tourCount })}</span>
                          {months && (
                            <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />{months}</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
