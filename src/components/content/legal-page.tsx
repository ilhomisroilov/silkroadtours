import { getTranslations } from "next-intl/server";
import { Markdown } from "@/components/common/markdown";
import { PageHero } from "@/components/common/page-hero";
import type { Locale } from "@/db/types";
import { contactSettings } from "@/lib/server/site";

/** Privacy policy / booking terms: Markdown text from the message files, with the agency name filled in. */
export async function LegalPage({ locale, kind }: { locale: Locale; kind: "privacy" | "terms" }) {
  const t = await getTranslations({ locale });
  const contact = await contactSettings();
  const body = String(t.raw(`nt.legal.${kind}.body`)).replaceAll("[[agency]]", contact.agencyName || t("meta.siteName"));
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t(`nt.legal.${kind}.title`), href: `/${kind}` },
        ]}
        title={t(`nt.legal.${kind}.title`)}
        lead={t(`nt.legal.${kind}.lead`)}
      >
        <p className="mt-4 text-sm text-ink-muted">{t(`nt.legal.${kind}.updated`)}</p>
      </PageHero>
      <div className="container-page py-10">
        <article className="max-w-3xl rounded-[1.5rem] bg-white p-6 shadow-card sm:p-10">
          <Markdown source={body} locale={locale} />
        </article>
      </div>
    </>
  );
}
