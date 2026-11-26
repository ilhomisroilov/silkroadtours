import { ArrowLeft, ArrowRight, Globe, MapPin, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ClientMessages } from "@/components/common/client-messages";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { SmartImage } from "@/components/common/smart-image";
import { PARTNER_TYPE_ICONS } from "@/components/partners/icons";
import { PartnerCard, PartnerMonogram } from "@/components/partners/partner-card";
import { partnerCity, servicePrice, toCardData } from "@/components/partners/view";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { getApprovedPartner, listApprovedPartners, listPartnerPlaces } from "@/db/queries/partners";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { partnerRefSlug, placeHref } from "@/lib/partners";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getApprovedPartner(db(), slug);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: "partnersPage" });
  return pageMetadata({ locale, href: `/partners/${p.slug}`, title: `${p.businessName} · ${t(`types.${p.type}`)}`, description: p.description.slice(0, 160) });
}

export default async function PartnerProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const partner = await getApprovedPartner(db(), slug);
  if (!partner) notFound();
  const [t, tr, destinations, placeList, all, currency, rates] = await Promise.all([
    getTranslations({ locale, namespace: "partnersPage" }),
    getTranslations({ locale }),
    listPublishedDestinations(db()),
    listPartnerPlaces(db(), partner.id, { publishedOnly: true }),
    listApprovedPartners(db()),
    requestCurrency(locale),
    exchangeRates(),
  ]);
  const ctx = { currency, rates, locale };
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const city = partnerCity(partner, destName);
  const typeLabel = t(`types.${partner.type}`);
  const TypeIcon = PARTNER_TYPE_ICONS[partner.type];
  const sameCity = all.filter((p) => p.id !== partner.id && p.destinationSlug && p.destinationSlug === partner.destinationSlug);
  const more = [...sameCity, ...all.filter((p) => p.id !== partner.id && !sameCity.includes(p) && p.type === partner.type), ...all.filter((p) => p.id !== partner.id)]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 3);
  const websiteHost = partner.website ? partner.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  return (
    <>
      <section className="bg-ai-soft relative overflow-hidden">
        <div className="container-page pb-12 pt-6 sm:pb-14">
          <Breadcrumbs
            label={tr("nav.breadcrumb")}
            base={`${siteUrl()}/${locale}`}
            items={[
              { name: tr("nav.home"), href: "/" },
              { name: t("crumb"), href: "/partners" },
              { name: partner.businessName, href: `/partners/${partner.slug}` },
            ]}
          />
          <div className="animate-fade-up mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <PartnerMonogram name={partner.businessName} size="lg" />
            <div className="min-w-0 max-w-3xl">
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-cobalt">
                <TypeIcon aria-hidden="true" className="size-4" /> {typeLabel}
              </p>
              <h1 className="mt-2 text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] leading-[1.08] text-lapis [overflow-wrap:anywhere]">{partner.businessName}</h1>
              <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-lapis">
                {city && (
                  <li>
                    {partner.destinationSlug && destName.has(partner.destinationSlug) ? (
                      <Link href={`/destinations/${partner.destinationSlug}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm hover:text-cobalt">
                        <MapPin aria-hidden="true" className="size-4 text-cobalt" /> {city}
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm">
                        <MapPin aria-hidden="true" className="size-4 text-cobalt" /> {city}
                      </span>
                    )}
                  </li>
                )}
                {partner.website && websiteHost && (
                  <li>
                    <a href={partner.website} target="_blank" rel="noopener nofollow" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 shadow-sm hover:text-cobalt">
                      <Globe aria-hidden="true" className="size-4 text-cobalt" /> {websiteHost}
                      <span className="sr-only">({t("profile.website")})</span>
                    </a>
                  </li>
                )}
                <li>
                  <a href="#inquiry" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-lapis px-4 text-white shadow-sm hover:bg-cobalt" data-testid="partner-inquire">
                    <MessageSquareText aria-hidden="true" className="size-4" /> {t("profile.inquire")}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <article className="min-w-0">
          <h2 className="text-2xl text-lapis">{t("profile.about")}</h2>
          <p className="mt-3 whitespace-pre-line text-lg text-ink/85">{partner.description}</p>

          <h2 className="mt-10 text-2xl text-lapis">{t("profile.services")}</h2>
          {partner.services.length === 0 ? (
            <p className="mt-3 text-ink-muted">{t("profile.servicesEmpty")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[1.25rem] bg-white shadow-card" data-testid="partner-services">
              {partner.services.map((s) => (
                <li key={s.name} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="shrink-0 font-bold text-lapis">{servicePrice(t, s, ctx)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 rounded-2xl bg-sky/60 p-4 text-sm text-ink/80">{t("profile.priceNote")}</p>

          {placeList.length > 0 && (
            <>
              <h2 className="mt-10 text-2xl text-lapis">{t("profile.listings")}</h2>
              <p className="mt-1 text-ink-muted">{t("profile.listingsText")}</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {placeList.map((pl) => (
                  <li key={pl.id}>
                    <Link href={placeHref(pl.kind, pl.slug)} className="group flex h-full gap-4 rounded-[1.25rem] bg-white p-3 shadow-card transition hover:shadow-lift">
                      <span className="block size-20 shrink-0 overflow-hidden rounded-xl">
                        <SmartImage src={pl.image} alt="" label={localize(pl.name, locale)} compact sizes="80px" />
                      </span>
                      <span className="min-w-0 self-center">
                        <span className="block font-bold leading-snug text-lapis group-hover:text-cobalt">{localize(pl.name, locale)}</span>
                        {pl.destinationSlug && destName.has(pl.destinationSlug) && <span className="block text-sm text-ink-muted">{destName.get(pl.destinationSlug)}</span>}
                        {pl.priceFromUsd != null && <span className="block text-sm font-semibold text-lapis">{t("from", { price: formatUsdIn(pl.priceFromUsd, currency, rates, locale) })}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link href="/partners" className="mt-10 inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis">
            <ArrowLeft aria-hidden="true" className="size-4" /> {t("profile.back")}
          </Link>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div id="inquiry" className="scroll-mt-24 rounded-[1.5rem] bg-white p-6 shadow-card">
            <h2 className="text-xl text-lapis">{t("profile.inquiryTitle", { name: partner.businessName })}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t("profile.inquiryText", { name: partner.businessName })}</p>
            <div className="mt-5">
              <ClientMessages namespaces={["services", "booking", "errors", "forms"]}>
                <ServiceRequestForm
                  kind="inquiry"
                  destinations={[]}
                  inquiry={{ topic: "general", subject: t("profile.inquirySubject", { name: partner.businessName }), refSlug: partnerRefSlug(partner.reference) }}
                  title={t("profile.inquire")}
                  submitLabel={t("profile.inquirySubmit")}
                  compact
                />
              </ClientMessages>
            </div>
          </div>
        </aside>
      </div>

      {more.length > 0 && (
        <section className="container-page pb-16" aria-labelledby="more-partners">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="more-partners" className="text-2xl text-lapis">{t("profile.more")}</h2>
            <Link href="/partners/apply" className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-cobalt hover:text-lapis">
              {t("ctaApply")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <li key={p.id} className="min-w-0">
                <PartnerCard partner={toCardData(t, p, destName, ctx)} cta={t("viewProfile")} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
