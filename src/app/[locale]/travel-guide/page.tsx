import { ArrowRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { EmptyState } from "@/components/ui/misc";
import { listContent } from "@/db/queries/content";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { db, pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/travel-guide", title: t("nt.guide.title"), description: t("nt.guide.lead") });
}

export default async function TravelGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const all = await listContent(db(), "guide");
  const categories = [...new Set(all.map((g) => g.category).filter((c): c is string => !!c))];
  const items = category ? all.filter((g) => g.category === category) : all;
  const chip = "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition";
  const catLabel = (c: string) => (t.has(`nt.guide.cat.${c}` as never) ? t(`nt.guide.cat.${c}` as never) : c);

  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.guide.title"), href: "/travel-guide" },
        ]}
        eyebrow={t("nt.guides.eyebrow")}
        title={t("nt.guide.title")}
        lead={t("nt.guide.lead")}
      >
        <nav aria-label={t("nt.guide.filter")} className="mt-8 flex flex-wrap gap-2">
          <Link href="/travel-guide" aria-current={!category ? "page" : undefined} className={`${chip} ${!category ? "bg-lapis text-white" : "bg-white text-ink hover:bg-sky"}`}>
            {t("nt.guide.all")}
          </Link>
          {categories.map((c) => (
            <Link key={c} href={{ pathname: "/travel-guide", query: { category: c } }} aria-current={category === c ? "page" : undefined} className={`${chip} ${category === c ? "bg-lapis text-white" : "bg-white text-ink hover:bg-sky"}`}>
              {catLabel(c)}
            </Link>
          ))}
        </nav>
      </PageHero>
      <div className="container-page py-12">
        {items.length === 0 ? (
          <EmptyState title={t("nt.guide.title")}>{t("nt.guide.empty")}</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((g) => (
              <li key={g.slug}>
                <Link href={`/travel-guide/${g.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="aspect-[16/9] overflow-hidden">
                    <SmartImage src={g.image} alt="" label={localize(g.title, locale)} compact sizes="(min-width: 1024px) 33vw, 50vw" imgClassName="transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                      {g.category && <span className="rounded-full bg-sky px-2.5 py-0.5 font-semibold text-cobalt">{catLabel(g.category)}</span>}
                      {g.readingMinutes != null && <span>{t("nt.guides.minutes", { count: g.readingMinutes })}</span>}
                    </p>
                    <h2 className="mt-3 text-xl leading-snug text-lapis group-hover:text-cobalt">{localize(g.title, locale)}</h2>
                    <p className="mt-2 line-clamp-3 text-ink-muted">{localize(g.excerpt, locale)}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-cobalt">
                      {t("nt.guides.read")} <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-[1.5rem] bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-sky"><HelpCircle aria-hidden="true" className="size-6 text-cobalt" /></span>
            <div>
              <h2 className="text-xl text-lapis">{t("nt.guide.faqTitle")}</h2>
              <p className="text-ink-muted">{t("nt.guide.faqText")}</p>
            </div>
          </div>
          <Link href="/faq" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
            {t("nt.footer.faq")} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
