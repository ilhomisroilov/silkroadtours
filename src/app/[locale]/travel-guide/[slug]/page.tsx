import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/common/markdown";
import { PageHero } from "@/components/common/page-hero";
import { SmartImage } from "@/components/common/smart-image";
import { AskAssistantButton } from "@/components/ai/ask-button";
import { getPublishedContent, listContent } from "@/db/queries/content";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { db, pageMetadata } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = await getPublishedContent(db(), "guide", slug);
  if (!g) return {};
  return pageMetadata({ locale, href: `/travel-guide/${slug}`, title: localize(g.title, locale), description: localize(g.excerpt, locale), image: g.image ?? undefined });
}

export default async function GuideArticlePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const g = await getPublishedContent(db(), "guide", slug);
  if (!g) notFound();
  const t = await getTranslations({ locale });
  const more = (await listContent(db(), "guide")).filter((x) => x.slug !== slug).slice(0, 3);
  const title = localize(g.title, locale);
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.guide.title"), href: "/travel-guide" },
          { name: title, href: `/travel-guide/${slug}` },
        ]}
        eyebrow={t("nt.guides.eyebrow")}
        title={title}
        lead={localize(g.excerpt, locale)}
      >
        {g.readingMinutes != null && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted"><Clock aria-hidden="true" className="size-4" />{t("nt.guides.minutes", { count: g.readingMinutes })}</p>
        )}
      </PageHero>
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article>
          {g.image && (
            <div className="mb-8 aspect-[16/8] overflow-hidden rounded-[1.5rem] shadow-card">
              <SmartImage src={g.image} alt={title} label={title} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            </div>
          )}
          <Markdown source={localize(g.body, locale)} locale={locale} />
          <Link href="/travel-guide" className="mt-10 inline-flex min-h-11 items-center gap-2 font-semibold text-cobalt hover:text-lapis">
            <ArrowLeft aria-hidden="true" className="size-4" /> {t("nt.guide.back")}
          </Link>
        </article>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-ai-soft rounded-[1.5rem] p-6 shadow-card">
            <h2 className="text-xl text-lapis">{t("nt.guide.askTitle")}</h2>
            <p className="mt-2 text-ink-muted">{t("nt.guide.askText")}</p>
            <AskAssistantButton label={t("nt.guide.askCta")} question={t("nt.guide.askQuestion", { title })} className="mt-4" />
          </div>
          {more.length > 0 && (
            <div className="rounded-[1.5rem] bg-white p-6 shadow-card">
              <h2 className="text-lg text-lapis">{t("nt.guide.more")}</h2>
              <ul className="mt-3 space-y-3">
                {more.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/travel-guide/${m.slug}`} className="font-semibold text-ink hover:text-cobalt">{localize(m.title, locale)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
