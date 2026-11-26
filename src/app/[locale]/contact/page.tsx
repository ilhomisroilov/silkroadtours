import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { SectionHeading } from "@/components/common/section";
import { ServiceCards } from "@/components/services/service-cards";
import type { Locale } from "@/db/types";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { contactSettings, pageMetadata, siteUrl } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, href: "/contact", title: t("metaTitle"), description: t("intro") });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const contact = await contactSettings();
  const links = messengerLinks(contact);
  const address = localize(contact.address, locale);
  const channels = [
    links.phone && { icon: Phone, label: t("contact.phone"), value: contact.phone, href: links.phone },
    contact.email && { icon: Mail, label: t("contact.email"), value: contact.email, href: `mailto:${contact.email}` },
    links.whatsapp && { icon: MessageCircle, label: t("contact.whatsapp"), value: contact.whatsapp, href: links.whatsapp },
    links.telegram && { icon: Send, label: t("contact.telegram"), value: contact.telegram, href: links.telegram },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string }[];
  return (
    <div className="container-page py-10">
      <Breadcrumbs label={t("nav.breadcrumb")} base={`${siteUrl()}/${locale}`} items={[{ name: t("nav.home"), href: "/" }, { name: t("nav.contact"), href: "/contact" }]} />
      <div className="mt-6">
        <SectionHeading as="h1" title={t("contact.title")} text={t("contact.intro")} />
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {channels.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-sand-soft p-6 md:col-span-2">{t("contact.noChannels")}</p>
        ) : (
          channels.map((c) => (
            <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel={c.href.startsWith("http") ? "noopener" : undefined} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card hover:shadow-lift">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-lapis text-saffron"><c.icon aria-hidden="true" className="size-6" /></span>
              <span>
                <span className="block text-sm text-ink-muted">{c.label}</span>
                <span className="font-semibold text-lapis-deep">{c.value}</span>
              </span>
            </a>
          ))
        )}
        {address && (
          <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-sand-soft p-6">
            <MapPin aria-hidden="true" className="size-6 text-terracotta" />
            <span><span className="block text-sm text-ink-muted">{t("contact.address")}</span><span className="font-semibold">{address}</span></span>
          </div>
        )}
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-sand-soft p-6">
          <Clock aria-hidden="true" className="size-6 text-terracotta" />
          <span>{t("contact.hours")}</span>
        </div>
      </div>
      <section className="mt-16" aria-labelledby="forms">
        <h2 id="forms" className="mb-6 text-3xl text-lapis-deep">{t("contact.formsTitle")}</h2>
        <ServiceCards locale={locale} />
      </section>
    </div>
  );
}
