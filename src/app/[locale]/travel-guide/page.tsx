import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { SectionHeading } from "@/components/common/section";
import { GirihRosette } from "@/components/ornament";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/primitives";
import { listFaq } from "@/db/queries/faq";
import { FAQ_CATEGORIES, type Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { db, pageMetadata, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return pageMetadata({ locale, href: "/travel-guide", title: t("metaTitle"), description: t("intro") });
}

export default async function TravelGuidePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const items = await listFaq(db());
  const groups = FAQ_CATEGORIES.map((c) => ({ category: c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length > 0);

  return (
    <div className="container-page py-10">
      <Breadcrumbs
        label={t("nav.breadcrumb")}
        base={`${siteUrl()}/${locale}`}
        items={[
          { name: t("nav.home"), href: "/" },
          { name: t("guide.title"), href: "/travel-guide" },
        ]}
      />
      <div className="mt-6">
        <SectionHeading as="h1" title={t("guide.title")} text={t("guide.intro")} />
      </div>
      {groups.length === 0 ? (
        <div className="mt-10"><EmptyState title={t("guide.title")}>{t("guide.empty")}</EmptyState></div>
      ) : (
        <div className="mt-12 grid gap-12 lg:grid-cols-[16rem_1fr]">
          <nav aria-label={t("guide.onThisPage")} className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">{t("guide.onThisPage")}</p>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0">
              {groups.map((g) => (
                <li key={g.category}>
                  <a href={`#${g.category}`} className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-lapis hover:bg-sand-soft lg:rounded-sm">
                    {t(`guide.categories.${g.category}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <ClientMessages namespaces={[]}>
            <div className="space-y-12">
              {groups.map((g) => (
                <section key={g.category} id={g.category} aria-labelledby={`${g.category}-title`} className="scroll-mt-24">
                  <h2 id={`${g.category}-title`} className="flex items-center gap-3 text-3xl text-lapis-deep">
                    <GirihRosette size={28} tone="saffron" strokeWidth={2.4} />
                    {t(`guide.categories.${g.category}`)}
                  </h2>
                  <Accordion type="multiple" className="mt-4">
                    {g.items.map((f) => (
                      <AccordionItem key={f.id} value={`q-${f.id}`}>
                        <AccordionTrigger>{localize(f.question, locale)}</AccordionTrigger>
                        <AccordionContent className="prose-silk text-ink">
                          {localize(f.answer, locale).split(/\n{2,}/).map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
              <div className="rounded-[var(--radius-card)] bg-sand-soft p-6">
                <h2 className="text-2xl text-lapis-deep">{t("guide.stillQuestions")}</h2>
                <p className="mt-1 text-ink-muted">{t("guide.stillQuestionsText")}</p>
                <Link href="/contact" className={buttonVariants({ variant: "secondary", className: "mt-4" })}>{t("nav.contact")}</Link>
              </div>
            </div>
          </ClientMessages>
        </div>
      )}
      <FaqJsonLd items={items.map((f) => ({ question: localize(f.question, locale), answer: localize(f.answer, locale) }))} />
    </div>
  );
}
