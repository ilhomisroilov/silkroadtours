import { ArrowLeft, BadgeDollarSign, Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientMessages } from "@/components/common/client-messages";
import { Markdown } from "@/components/common/markdown";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { ExperienceCard } from "@/components/content/experience-card";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import { getPublishedContent, listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const e = await getPublishedContent(db(), "experience", slug);
  if (!e) return {};
  return pageMetadata({ locale, href: `/experiences/${slug}`, title: localize(e.title, locale), description: localize(e.excerpt, locale), image: e.image ?? undefined });
}

export default async function ExperiencePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const e = await getPublishedContent(db(), "experience", slug);
  if (!e) notFound();
  const t = await getTranslations({ locale });
  const [all, destinations, currency, rates] = await Promise.all([
    listContent(db(), "experience"),
    listPublishedDestinations(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const placeName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const title = localize(e.title, locale);
  const place = e.destinationSlug ? placeName.get(e.destinationSlug) : undefined;
  const price = e.priceFromUsd != null ? formatUsdIn(e.priceFromUsd, currency, rates, locale) : null;
  const sameCategory = all.filter((x) => x.slug !== slug && x.category === e.category);
  const more = [...sameCategory, ...all.filter((x) => x.slug !== slug && x.category !== e.category)].slice(0, 4);

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.expPage.title"), href: "/experiences" },
          { name: title, href: `/experiences/${slug}` },
        ]}
        eyebrow={e.category && t.has(`nt.expPage.cat.${e.category}` as never) ? t(`nt.expPage.cat.${e.category}` as never) : t("nt.exp.eyebrow")}
        title={title}
        lead={localize(e.excerpt, locale)}
      >
        <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold text-lapis">
          {place && e.destinationSlug && (
            <li>
              <Link href={`/destinations/${e.destinationSlug}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm hover:text-cobalt">
                <MapPin aria-hidden="true" className="size-4 text-cobalt" /> {place}
              </Link>
            </li>
          )}
          {e.durationHours != null && (
            <li className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm">
              <Clock aria-hidden="true" className="size-4 text-cobalt" /> {t("nt.exp.hours", { count: e.durationHours })}
            </li>
          )}
          {price && (
            <li className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm">
              <BadgeDollarSign aria-hidden="true" className="size-4 text-cobalt" /> {t("nt.exp.from", { price })}
            </li>
          )}
        </ul>
      </PageHero>
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <article>
          {e.image && (
            <div className="mb-8 aspect-[16/8] overflow-hidden rounded-[1.5rem] shadow-card">
              <SmartImage src={e.image} alt={title} label={title} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            </div>
          )}
          <Markdown source={localize(e.body, locale)} locale={locale} />
          <p className="mt-8 rounded-2xl bg-sky/60 p-4 text-sm text-ink/80">{t("nt.expPage.priceNote")}</p>
          <Link href="/experiences" className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis">
            <ArrowLeft aria-hidden="true" className="size-4" /> {t("nt.expPage.back")}
          </Link>
        </article>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div id="request" className="rounded-[1.5rem] bg-white p-6 shadow-card">
            {price && (
              <p className="text-sm text-ink-muted">
                {t("nt.expPage.perPerson")}
                <span className="block text-3xl font-extrabold text-lapis">{t("nt.exp.from", { price })}</span>
              </p>
            )}
            <p className="mt-3 text-sm text-ink-muted">{t("nt.expPage.requestText")}</p>
            <div className="mt-5">
              <ClientMessages namespaces={["services", "booking", "errors", "forms"]}>
                <ServiceRequestForm
                  kind="inquiry"
                  destinations={[]}
                  inquiry={{ topic: "experience", subject: title, refSlug: slug }}
                  title={t("nt.expPage.requestTitle")}
                  submitLabel={t("nt.expPage.submit")}
                  compact
                />
              </ClientMessages>
            </div>
          </div>
        </aside>
      </div>
      {more.length > 0 && (
        <section className="container-page pb-16" aria-labelledby="more-exp">
          <h2 id="more-exp" className="text-2xl text-lapis">{t("nt.expPage.more")}</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {more.map((x) => (
              <li key={x.slug}>
                <ExperienceCard
                  item={x}
                  locale={locale}
                  place={x.destinationSlug ? placeName.get(x.destinationSlug) : undefined}
                  hours={x.durationHours != null ? t("nt.exp.hours", { count: x.durationHours }) : undefined}
                  price={x.priceFromUsd != null ? t("nt.exp.from", { price: formatUsdIn(x.priceFromUsd, currency, rates, locale) }) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
