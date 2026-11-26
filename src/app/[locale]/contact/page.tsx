import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { ServiceCards } from "@/components/services/service-cards";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import type { Locale } from "@/db/types";
import { messengerLinks } from "@/lib/links";
import { localize } from "@/lib/localize";
import { contactSettings, pageMetadata } from "@/lib/server/site";

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
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nav.contact"), href: "/contact" },
        ]}
        eyebrow={t("nt.contactPage.eyebrow")}
        title={t("contact.title")}
        lead={t("contact.intro")}
      />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="space-y-5">
          {channels.length === 0 ? (
            <p className="rounded-[1.25rem] bg-white p-6 shadow-card">{t("contact.noChannels")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {channels.map((c) => (
                <li key={c.label}>
                  <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel={c.href.startsWith("http") ? "noopener" : undefined} className="flex h-full items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky text-cobalt"><c.icon aria-hidden="true" className="size-6" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-muted">{c.label}</span>
                      <span className="block truncate font-bold text-lapis">{c.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {address && (
              <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-card">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky text-cobalt"><MapPin aria-hidden="true" className="size-6" /></span>
                <span><span className="block text-sm text-ink-muted">{t("contact.address")}</span><span className="font-bold text-lapis">{address}</span></span>
              </div>
            )}
            <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-card">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky text-cobalt"><Clock aria-hidden="true" className="size-6" /></span>
              <span className="text-sm text-ink/80">{t("contact.hours")}</span>
            </div>
          </div>
          <section className="pt-6" aria-labelledby="forms">
            <h2 id="forms" className="mb-5 text-2xl text-lapis">{t("contact.formsTitle")}</h2>
            <ServiceCards locale={locale} limit={6} />
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-card">
            <p className="mb-4 text-sm text-ink-muted">{t("nt.contactPage.formText")}</p>
            <ClientMessages namespaces={["services", "booking", "errors", "forms"]}>
              <ServiceRequestForm kind="inquiry" destinations={[]} inquiry={{ topic: "general" }} title={t("nt.contactPage.formTitle")} compact />
            </ClientMessages>
          </div>
        </aside>
      </div>
    </>
  );
}
