import { ArrowRight, CircleCheck, CircleX, Clock3, ExternalLink, Globe, Mail, MapPin, MessageSquareText, Phone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ClientMessages } from "@/components/common/client-messages";
import { SmartImage } from "@/components/common/smart-image";
import { PartnerDashboardEditor } from "@/components/partners/dashboard-editor";
import { PartnerMonogram } from "@/components/partners/partner-card";
import { partnerCity, servicePrice } from "@/components/partners/view";
import { EmptyState } from "@/components/ui/misc";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { getPartnerByCredentials, listPartnerPlaces, partnerInquiries, publicSlugOf, redactInquiries } from "@/db/queries/partners";
import type { Locale, PartnerStatus } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/format";
import { localize } from "@/lib/localize";
import { parseServices, placeHref } from "@/lib/partners";
import { db, exchangeRates, pageMetadata, requestCurrency, siteUrl } from "@/lib/server/site";
import { partnerCredentialsSchema } from "@/validators/partner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partnersPage" });
  const meta = await pageMetadata({ locale, href: "/partners/dashboard", title: t("dashboard.metaTitle"), noIndex: true });
  // The URL carries the partner's private token: never send it on to other sites.
  return { ...meta, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

const STATUS_STYLE: Record<PartnerStatus, { cls: string; icon: typeof Clock3 }> = {
  pending: { cls: "bg-saffron-soft text-saffron-ink ring-saffron/40", icon: Clock3 },
  approved: { cls: "bg-success/10 text-success ring-success/30", icon: CircleCheck },
  rejected: { cls: "bg-danger/10 text-danger ring-danger/30", icon: CircleX },
};

const tashkentDate = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

export default async function PartnerDashboardPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tr] = await Promise.all([getTranslations({ locale, namespace: "partnersPage" }), getTranslations({ locale })]);
  const creds = partnerCredentialsSchema.safeParse(await searchParams);
  const partner = creds.success ? await getPartnerByCredentials(db(), creds.data.ref, creds.data.token) : null;
  const crumbs = [
    { name: tr("nav.home"), href: "/" },
    { name: t("crumb"), href: "/partners" },
    { name: t("dashboard.title"), href: "/partners/dashboard" },
  ];

  if (!partner || !creds.success) {
    return (
      <div className="container-page py-10">
        <Breadcrumbs label={tr("nav.breadcrumb")} base={`${siteUrl()}/${locale}`} items={crumbs} />
        <div className="mt-8">
          <EmptyState
            title={t("dashboard.notFoundTitle")}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/partners/apply" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt">{t("dashboard.applyCta")}</Link>
                <Link href="/contact" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-lapis ring-1 ring-lapis-mist hover:bg-sky">{t("dashboard.contactCta")}</Link>
              </div>
            }
          >
            {t("dashboard.notFoundText")}
          </EmptyState>
        </div>
      </div>
    );
  }

  const [destinations, placeList, currency, rates, publicSlug] = await Promise.all([
    listPublishedDestinations(db()),
    listPartnerPlaces(db(), partner.id),
    requestCurrency(locale),
    exchangeRates(),
    partner.status === "approved" ? publicSlugOf(db(), partner.id) : Promise.resolve(null),
  ]);
  const inquiries = await partnerInquiries(db(), partner, placeList, 10);
  const latest = redactInquiries(inquiries.items);
  const destName = new Map(destinations.map((d) => [d.slug, localize(d.name, locale)]));
  const services = parseServices(partner.services);
  const ctx = { currency, rates, locale };
  const date = (iso: string) => formatDateLabel(iso, (m) => tr(`monthsShort.${m}`));
  const style = STATUS_STYLE[partner.status];
  const StatusIcon = style.icon;
  const city = partnerCity(partner, destName);
  const metrics = [
    { label: t("dashboard.metrics.inquiries"), value: inquiries.total },
    { label: t("dashboard.metrics.last30"), value: inquiries.last30 },
    { label: t("dashboard.metrics.services"), value: services.length },
    { label: t("dashboard.metrics.places"), value: placeList.length },
  ];

  return (
    <div className="bg-sand-soft/40 pb-16">
      <section className="bg-ai-soft">
        <div className="container-page pb-10 pt-6">
          <Breadcrumbs label={tr("nav.breadcrumb")} base={`${siteUrl()}/${locale}`} items={crumbs} />
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <PartnerMonogram name={partner.businessName} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.1em] text-cobalt">{t("dashboard.title")}</p>
                <h1 className="mt-1 text-[clamp(1.75rem,1.3rem+2vw,2.75rem)] leading-tight text-lapis [overflow-wrap:anywhere]">{partner.businessName}</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  {t("dashboard.reference", { reference: partner.reference })} · {t("dashboard.submittedOn", { date: date(tashkentDate(partner.createdAt)) })}
                </p>
              </div>
            </div>
            {publicSlug && (
              <Link href={`/partners/${publicSlug}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt sm:self-center" data-testid="partner-public-link">
                {t("dashboard.viewPublic")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="container-page mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Status */}
          <section aria-labelledby="status-title" className="rounded-[1.25rem] bg-white p-5 shadow-card sm:p-6">
            <h2 id="status-title" className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">{t("dashboard.status")}</h2>
            <p className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-bold ring-1", style.cls)} data-testid="partner-status">
              <StatusIcon aria-hidden="true" className="size-5" /> {t(`dashboard.statusLabels.${partner.status}`)}
            </p>
            <p className="mt-3 text-ink/85">{t(`dashboard.statusText.${partner.status}`)}</p>
            {partner.reviewedAt && <p className="mt-1 text-sm text-ink-muted">{t("dashboard.reviewedOn", { date: date(tashkentDate(partner.reviewedAt)) })}</p>}
            {partner.adminNote && (
              <div className="mt-4 rounded-xl border-l-4 border-saffron bg-saffron-soft/60 p-4">
                <p className="text-sm font-bold text-saffron-ink">{t("dashboard.note")}</p>
                <p className="mt-1 whitespace-pre-line text-ink">{partner.adminNote}</p>
              </div>
            )}
          </section>

          {/* Metrics: real counts only */}
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.map((m) => (
              <li key={m.label} className="rounded-[1.25rem] bg-white p-4 shadow-card">
                <p className="font-display text-3xl font-extrabold text-lapis tabular-nums">{m.value}</p>
                <p className="mt-1 text-sm text-ink-muted">{m.label}</p>
              </li>
            ))}
          </ul>

          {/* Services */}
          <section aria-labelledby="services-title" className="rounded-[1.25rem] bg-white p-5 shadow-card sm:p-6">
            <h2 id="services-title" className="text-xl text-lapis">{t("dashboard.services")}</h2>
            {services.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {services.map((s) => (
                  <li key={s.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{s.name}</span>
                    <span className="shrink-0 font-bold text-lapis">{servicePrice(t, s, ctx)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              {partner.status === "pending" ? (
                <ClientMessages namespaces={["partnersPage", "errors"]}>
                  <PartnerDashboardEditor reference={partner.reference} token={creds.data.token} description={partner.description} services={services} />
                </ClientMessages>
              ) : (
                <p className="text-sm text-ink-muted">{t("dashboard.editLocked")}</p>
              )}
            </div>
          </section>

          {/* Inquiries */}
          <section aria-labelledby="inq-title" className="rounded-[1.25rem] bg-white p-5 shadow-card sm:p-6">
            <h2 id="inq-title" className="text-xl text-lapis">{t("dashboard.inquiriesTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("dashboard.inquiriesText")}</p>
            {latest.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-sand-soft p-4 text-ink-muted">
                <MessageSquareText aria-hidden="true" className="size-5" /> {t("dashboard.inquiriesEmpty")}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[34rem] text-left text-sm" data-testid="partner-inquiries">
                  <thead className="bg-sand-soft text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">{t("dashboard.colDate")}</th>
                      <th scope="col" className="px-4 py-3">{t("dashboard.colGuest")}</th>
                      <th scope="col" className="px-4 py-3">{t("dashboard.colSubject")}</th>
                      <th scope="col" className="px-4 py-3">{t("dashboard.colTravel")}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t("dashboard.colGroup")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.map((i) => (
                      <tr key={i.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-4 py-3">{date(tashkentDate(i.createdAt))}</td>
                        <td className="px-4 py-3 font-semibold">{i.firstName}</td>
                        <td className="px-4 py-3">{i.subject ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3">{i.date ? date(i.date) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{i.groupSize ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="profile-title" className="rounded-[1.25rem] bg-white p-5 shadow-card sm:p-6">
            <h2 id="profile-title" className="text-xl text-lapis">{t("dashboard.profile")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dashboard.type")}</dt>
                <dd className="mt-0.5 font-semibold">{t(`types.${partner.type}`)}</dd>
              </div>
              {city && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dashboard.city")}</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-semibold"><MapPin aria-hidden="true" className="size-4 text-cobalt" /> {city}</dd>
                </div>
              )}
              {partner.website && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dashboard.website")}</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 break-all font-semibold"><Globe aria-hidden="true" className="size-4 shrink-0 text-cobalt" /> {partner.website.replace(/^https?:\/\//, "")}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dashboard.contact")}</dt>
                <dd className="mt-0.5 space-y-1">
                  <span className="flex items-center gap-1.5 font-semibold"><UserRound aria-hidden="true" className="size-4 text-cobalt" /> {partner.contactName}</span>
                  <span className="flex items-center gap-1.5 break-all"><Mail aria-hidden="true" className="size-4 shrink-0 text-cobalt" /> {partner.email}</span>
                  <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="size-4 text-cobalt" /> {partner.phone}</span>
                </dd>
              </div>
            </dl>
            <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm text-ink/85">{partner.description}</p>
          </section>

          <section aria-labelledby="places-title" className="rounded-[1.25rem] bg-white p-5 shadow-card sm:p-6">
            <h2 id="places-title" className="text-xl text-lapis">{t("dashboard.places")}</h2>
            {placeList.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">{t("dashboard.placesEmpty")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {placeList.map((pl) => (
                  <li key={pl.id} className="flex items-center gap-3">
                    <span className="block size-14 shrink-0 overflow-hidden rounded-xl">
                      <SmartImage src={pl.image} alt="" label={localize(pl.name, locale)} compact sizes="56px" />
                    </span>
                    <span className="min-w-0 text-sm">
                      {pl.isPublished ? (
                        <Link href={placeHref(pl.kind, pl.slug)} className="font-bold text-lapis underline-offset-4 hover:underline">
                          {localize(pl.name, locale)} <ExternalLink aria-hidden="true" className="inline size-3.5" />
                        </Link>
                      ) : (
                        <span className="font-bold text-lapis">{localize(pl.name, locale)}</span>
                      )}
                      <span className="block text-ink-muted">
                        {[pl.destinationSlug ? destName.get(pl.destinationSlug) : null, pl.isPublished ? null : t("dashboard.unpublished")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
