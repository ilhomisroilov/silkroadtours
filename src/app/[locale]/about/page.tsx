import { Handshake, MessageSquareText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { SectionHeading } from "@/components/common/section";
import { GirihPattern, SuzaniMedallion } from "@/components/ornament";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { contactSettings, pageMetadata, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, href: "/about", title: t("metaTitle"), description: t("lead") });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const contact = await contactSettings();
  const values = [
    { icon: Wallet, title: t("about.value1Title"), text: t("about.value1Text") },
    { icon: MessageSquareText, title: t("about.value2Title"), text: t("about.value2Text") },
    { icon: Handshake, title: t("about.value3Title"), text: t("about.value3Text") },
  ];
  return (
    <div className="container-page py-10">
      <Breadcrumbs label={t("nav.breadcrumb")} base={`${siteUrl()}/${locale}`} items={[{ name: t("nav.home"), href: "/" }, { name: t("nav.about"), href: "/about" }]} />
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionHeading as="h1" title={t("about.title")} />
          <p className="mt-6 text-xl text-ink">{t("about.lead")}</p>
          <div className="prose-silk mt-5 text-lg text-ink-muted">
            <p>{t("about.p1")}</p>
            <p>{t("about.p2")}</p>
          </div>
          {contact.licenseNumber && <p className="mt-5 font-semibold">{t("about.licence", { number: contact.licenseNumber })}</p>}
          <Link href="/tours" className={buttonVariants({ className: "mt-8" })}>{t("about.cta")}</Link>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-t-full bg-lapis-deep lg:col-span-5">
          <GirihPattern className="absolute inset-0" tone="saffron" opacity={0.35} />
          <SuzaniMedallion size={220} palette="night" className="relative" />
        </div>
      </div>
      <section className="mt-20" aria-labelledby="values">
        <SectionHeading id="values" title={t("about.valuesTitle")} />
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {values.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
              <Icon aria-hidden="true" className="size-8 text-terracotta" />
              <h3 className="mt-4 text-2xl text-lapis-deep">{title}</h3>
              <p className="mt-2 text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
