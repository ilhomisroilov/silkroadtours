import { ArrowRight, BookOpen, Compass, Globe2, Handshake, Languages, MapPinned, MessageSquareText, PencilRuler, Wallet, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/common/motion";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { buttonVariants } from "@/components/ui/button";
import { listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { contactSettings, db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, href: "/about", title: t("metaTitle"), description: t("lead") });
}

const COLLAGE = ["samarkand", "bukhara", "nuratau"];

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const currency = await requestCurrency(locale);
  const [contact, destinations, tours, guides] = await Promise.all([
    contactSettings(),
    listPublishedDestinations(db()),
    listPublishedTours(db(), { sort: "featured", currency, page: 1, pageSize: 1 }, await exchangeRates()),
    listContent(db(), "guide"),
  ]);
  const bySlug = new Map(destinations.map((d) => [d.slug, d]));
  const collage = COLLAGE.map((s) => bySlug.get(s)).filter((d) => d != null);
  const values = [
    { icon: Wallet, title: t("about.value1Title"), text: t("about.value1Text") },
    { icon: MessageSquareText, title: t("about.value2Title"), text: t("about.value2Text") },
    { icon: Handshake, title: t("about.value3Title"), text: t("about.value3Text") },
  ];
  const facts = [
    { icon: MapPinned, title: t("about.factDestinations", { count: destinations.length }), text: t("about.factDestinationsText") },
    { icon: Compass, title: t("about.factTours", { count: tours.total }), text: t("about.factToursText") },
    { icon: BookOpen, title: t("about.factGuides", { count: guides.length }), text: t("about.factGuidesText") },
    { icon: Languages, title: t("about.factLanguages"), text: t("about.factLanguagesText") },
  ];
  const audiences = [
    { href: "/inbound" as const, title: t("audience.inbound"), text: t("about.inboundText"), image: bySlug.get("khiva")?.heroImage ?? collage[0]?.heroImage ?? "" },
    { href: "/domestic" as const, title: t("audience.domestic"), text: t("about.domesticText"), image: bySlug.get("chimgan-charvak")?.heroImage ?? collage[2]?.heroImage ?? "" },
  ];

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nav.about"), href: "/about" },
        ]}
        eyebrow={t("about.eyebrow")}
        title={t("about.title")}
        lead={t("about.lead")}
      />

      <div className="container-page space-y-20 py-14">
        <section className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="prose-silk text-lg text-ink">
              <p>{t("about.p1")}</p>
              <p>{t("about.p2")}</p>
            </div>
            {contact.licenseNumber && <p className="mt-5 font-semibold text-lapis">{t("about.licence", { number: contact.licenseNumber })}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/tours" className={buttonVariants({ variant: "primary" })}>
                {t("about.cta")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link href="/contact" className={buttonVariants({ variant: "outline" })}>{t("about.ctaContact")}</Link>
            </div>
          </div>
          {collage.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:col-span-6" aria-hidden="true">
              {collage.map((d, i) => (
                <div
                  key={d.slug}
                  className={i === 0 ? "row-span-2 overflow-hidden rounded-[1.5rem] shadow-card" : "overflow-hidden rounded-[1.5rem] shadow-card"}
                >
                  <div className={i === 0 ? "h-full min-h-72" : "aspect-[4/3]"}>
                    <SmartImage src={d.heroImage} alt="" label={localize(d.name, locale)} sizes="(min-width: 1024px) 25vw, 50vw" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="facts-title">
          <h2 id="facts-title" className="text-2xl text-lapis">{t("about.factsTitle")}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 0.05} className="flex items-start gap-4 rounded-[1.25rem] border border-line bg-white p-5 shadow-card">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky text-cobalt">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-lg font-bold text-lapis">{title}</p>
                  <p className="text-sm text-ink-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        <section aria-labelledby="values" className="rounded-[2rem] bg-sky/50 p-6 sm:p-10">
          <h2 id="values" className="text-2xl text-lapis sm:text-3xl">{t("about.valuesTitle")}</h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[1.25rem] bg-white p-6 shadow-card">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-lapis text-saffron">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <h3 className="mt-4 text-xl text-lapis">{title}</h3>
                <p className="mt-2 text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="audiences">
          <h2 id="audiences" className="text-2xl text-lapis sm:text-3xl">{t("about.audienceTitle")}</h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {audiences.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="group relative block overflow-hidden rounded-[1.5rem] shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="aspect-[16/9]">
                    <SmartImage src={a.image} alt="" label={a.title} imgClassName="transition-transform duration-700 group-hover:scale-105" sizes="(min-width: 768px) 50vw, 100vw" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-lapis-deep/90 via-lapis-deep/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white">
                    <div>
                      <h3 className="text-2xl text-white">{a.title}</h3>
                      <p className="mt-1 max-w-md text-sm text-white/85">{a.text}</p>
                    </div>
                    <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/90 text-lapis transition group-hover:bg-saffron">
                      <ArrowRight className="size-5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about-cta" className="relative overflow-hidden rounded-[2rem] bg-lapis p-8 text-white sm:p-12">
          <Globe2 aria-hidden="true" className="absolute -right-10 -top-10 size-56 text-white/5" />
          <h2 id="about-cta" className="relative text-3xl text-white">{t("about.ctaTitle")}</h2>
          <p className="relative mt-3 max-w-2xl text-lg text-white/90">{t("about.ctaText")}</p>
          <div className="relative mt-7 flex flex-wrap gap-3">
            <Link href="/planner" className={buttonVariants({ variant: "saffron" })}>
              <Wand2 aria-hidden="true" className="size-4" /> {t("about.ctaPlanner")}
            </Link>
            <Link href="/custom-tour" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/15 px-5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-black/25">
              <PencilRuler aria-hidden="true" className="size-4" /> {t("about.ctaBuilder")}
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/15 px-5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-black/25">
              <MessageSquareText aria-hidden="true" className="size-4" /> {t("about.ctaContact")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
