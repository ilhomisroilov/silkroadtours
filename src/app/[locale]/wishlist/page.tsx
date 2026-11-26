import { ArrowRight, Heart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { PageHero } from "@/components/common/page-hero";
import { WishlistCompareLink, WishlistGrid } from "@/components/common/wishlist";
import { TourCard } from "@/components/tours/tour-card";
import { listPublishedTours } from "@/db/queries/tours";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return pageMetadata({ locale, href: "/wishlist", title: t("nt.wishlist.title"), description: t("nt.wishlist.lead"), noIndex: true });
}

/** Saved tours live in the visitor's browser; the page renders every published tour card and shows the saved ones. */
export default async function WishlistPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [rates, currency] = await Promise.all([exchangeRates(), requestCurrency(locale)]);
  const { items } = await listPublishedTours(db(), { currency, sort: "featured", page: 1, pageSize: 500 }, rates);
  const cards = await Promise.all(items.map(async (tour) => ({ slug: tour.slug, node: await TourCard({ tour, locale }) })));
  return (
    <>
      <PageHero
        locale={locale}
        crumbLabel={t("nav.breadcrumb")}
        crumbs={[
          { name: t("nav.home"), href: "/" },
          { name: t("nt.wishlist.title"), href: "/wishlist" },
        ]}
        title={t("nt.wishlist.title")}
        lead={t("nt.wishlist.lead")}
      >
        <div className="mt-6">
          <ClientMessages namespaces={["nt"]}>
            <WishlistCompareLink label={t("nt.wishlist.compare")} />
          </ClientMessages>
        </div>
      </PageHero>
      <div className="container-page py-10">
        <ClientMessages namespaces={["nt", "tours", "tour", "badges", "categories"]}>
          <WishlistGrid
            items={cards}
            empty={
              <div className="rounded-[1.5rem] bg-white p-10 text-center shadow-card">
                <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-sky"><Heart aria-hidden="true" className="size-7 text-cobalt" /></span>
                <p className="mx-auto mt-4 max-w-md text-lg text-ink/80">{t("nt.wishlist.empty")}</p>
                <Link href="/tours" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">
                  {t("nt.wishlist.browse")} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            }
          />
        </ClientMessages>
      </div>
    </>
  );
}
