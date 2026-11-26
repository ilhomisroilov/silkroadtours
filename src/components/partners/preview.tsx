import { ArrowRight, Handshake } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "@/components/common/section";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listApprovedPartners, type PublicPartner } from "@/db/queries/partners";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { PARTNER_TYPE_LIST } from "@/lib/partners";
import { db } from "@/lib/server/site";
import { PARTNER_TYPE_ICONS } from "./icons";
import { PartnerMonogram } from "./partner-card";
import { partnerCity } from "./view";

/** One partner of each type first, so the preview shows the breadth of the network. */
function pickVaried(all: PublicPartner[], n: number): PublicPartner[] {
  const out: PublicPartner[] = [];
  for (const ty of PARTNER_TYPE_LIST) {
    const p = all.find((x) => x.type === ty);
    if (p) out.push(p);
  }
  for (const p of all) if (!out.includes(p)) out.push(p);
  return out.slice(0, n);
}

/** Homepage section: the partner ecosystem — business types, a few partners and the call to join. */
export async function PartnersPreview({ locale }: { locale: Locale }) {
  const [t, all, destinations] = await Promise.all([
    getTranslations({ locale, namespace: "partnersPage" }),
    listApprovedPartners(db()),
    listPublishedDestinations(db()),
  ]);
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const shown = pickVaried(all, 6);

  return (
    <section className="container-page pt-20" aria-labelledby="partners-preview-title" data-testid="partners-preview">
      <div className="grid gap-8 rounded-[1.75rem] bg-white p-6 shadow-card ring-1 ring-line/60 sm:p-8 lg:grid-cols-12 lg:gap-10 lg:p-10">
        <div className="lg:col-span-5">
          <SectionHeading id="partners-preview-title" eyebrow={t("preview.eyebrow")} title={t("preview.title")} text={t("preview.text")} />
          <ul className="mt-6 grid grid-cols-2 gap-2" aria-label={t("whoTitle")}>
            {PARTNER_TYPE_LIST.map((ty) => {
              const Icon = PARTNER_TYPE_ICONS[ty];
              return (
                <li key={ty} className="flex min-h-10 items-center gap-2 rounded-xl bg-sand-soft px-3 py-2 text-sm font-semibold text-lapis">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-cobalt" />
                  <span className="min-w-0 leading-tight">{t(`typeGroups.${ty}`)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/partners/apply" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-lapis px-6 font-bold text-white transition hover:bg-cobalt">
              <Handshake aria-hidden="true" className="size-5" /> {t("preview.cta")}
            </Link>
            <Link href="/partners" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-semibold text-cobalt hover:text-lapis">
              {t("preview.all")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
        {shown.length > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-7">
          <ul className="grid content-start gap-3 sm:grid-cols-2">
            {shown.map((p) => {
              const city = partnerCity(p, destName);
              return (
                <li key={p.id}>
                  <Link href={`/partners/${p.slug}`} className="group flex h-full items-center gap-4 rounded-[1.25rem] border border-line bg-ivory p-4 transition hover:border-lapis/30 hover:bg-white hover:shadow-card">
                    <PartnerMonogram name={p.businessName} />
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug text-lapis [overflow-wrap:anywhere] group-hover:text-cobalt">{p.businessName}</span>
                      <span className="mt-0.5 block text-sm text-ink-muted">{[t(`types.${p.type}`), city].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold text-lapis">
            <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-saffron" />{t("stats.partners", { count: all.length })}</span>
            <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-saffron" />{t("stats.cities", { count: new Set(all.map((p) => p.destinationSlug ?? p.city)).size })}</span>
          </p>
          </div>
        )}
      </div>
    </section>
  );
}
