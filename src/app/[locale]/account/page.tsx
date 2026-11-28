import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountClient } from "@/components/account/account-client";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import type { Locale } from "@/db/types";
import { pageMetadata } from "@/lib/server/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/account", title: t("account.title"), description: t("account.lead"), noIndex: true });
}

/** Traveller's own page: sign in or sign up, then profile and booking requests. Everything personal loads in the browser. */
export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("account.title"), href: "/account" },
        ]}
        title={t("account.title")}
        lead={t("account.lead")}
      />
      <div className="container-page py-10">
        <ClientMessages namespaces={["account"]}>
          <AccountClient />
        </ClientMessages>
      </div>
    </>
  );
}
