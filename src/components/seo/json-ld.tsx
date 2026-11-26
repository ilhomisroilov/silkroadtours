import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { localize } from "@/lib/localize";
import { contactSettings, siteUrl } from "@/lib/server/site";

/** Renders schema.org JSON-LD safely (no "</script>" breakout). */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** TravelAgency — only real contact fields are included. */
export async function OrganizationJsonLd({ locale }: { locale: Locale }) {
  const contact = await contactSettings();
  const t = await getTranslations({ locale, namespace: "meta" });
  const base = siteUrl();
  const sameAs = [contact.telegram ? `https://t.me/${contact.telegram.replace(/^@/, "")}` : null].filter(Boolean);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "TravelAgency",
        "@id": `${base}/#agency`,
        name: contact.agencyName || t("siteName"),
        url: `${base}/${locale}`,
        description: t("defaultDescription"),
        logo: `${base}/icon.svg`,
        ...(contact.phone ? { telephone: contact.phone } : {}),
        ...(contact.email ? { email: contact.email } : {}),
        address: {
          "@type": "PostalAddress",
          addressLocality: locale === "ru" ? "Джизак" : locale === "uz" ? "Jizzax" : "Jizzakh",
          addressCountry: "UZ",
          ...(localize(contact.address, locale) ? { streetAddress: localize(contact.address, locale) } : {}),
        },
        areaServed: { "@type": "Country", name: "Uzbekistan" },
        availableLanguage: ["en", "uz", "ru"],
        currenciesAccepted: "USD, UZS, EUR",
        ...(sameAs.length ? { sameAs } : {}),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
      }}
    />
  );
}

export function FaqJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: { "@type": "Answer", text: q.answer },
        })),
      }}
    />
  );
}
