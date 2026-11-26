import { ArrowRight, Car, CreditCard, Info, Plane, TrainFront, TramFront, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/components/common/client-messages";
import { PhotoHero } from "@/components/common/photo-hero";
import { SmartImage } from "@/components/common/smart-image";
import { AddToTripButton } from "@/components/places/add-to-trip-button";
import { TransportSearch, type SearchState } from "@/components/places/transport-search";
import { listPlaces } from "@/db/queries/places";
import type { Locale } from "@/db/types";
import { getPathname, Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import type { TransportInfo } from "@/lib/places/extras";
import { first, type SearchParams } from "@/lib/places/query";
import {
  CITY_DESTINATION,
  cityKeyOf,
  connectedCities,
  normalizeCity,
  SEARCH_MODES,
  tashkentDate,
  type CityKey,
  type RouteData,
  type SearchMode,
} from "@/lib/places/schedule";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, pageMetadata, requestCurrency } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transportSearch" });
  return pageMetadata({
    locale,
    href: "/transport",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const POPULAR: [CityKey, CityKey][] = [
  ["tashkent", "samarkand"],
  ["samarkand", "bukhara"],
  ["tashkent", "khiva"],
  ["tashkent", "bukhara"],
  ["tashkent", "termez"],
];

/** Localized service label (shown next to the mode) from the route's mode and tags. */
const serviceKey = (mode: string, tags: string[]): string =>
  tags.includes("high-speed")
    ? "highSpeed"
    : tags.includes("sleeper") || tags.includes("overnight")
      ? "sleeper"
      : ((
          {
            train: "dayTrain",
            flight: "airline",
            bus: "coach",
            shared_taxi: "sharedTaxi",
            car: "privateCar",
          } as Record<string, string>
        )[mode] ?? "dayTrain");

const classKey = (en: string, i: number): string =>
  en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `class_${i}`;

export default async function TransportPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [t, tn] = await Promise.all([getTranslations({ locale, namespace: "transportSearch" }), getTranslations({ locale, namespace: "nav" })]);
  const [places, currency, rates] = await Promise.all([listPlaces(db(), { kind: "transport" }), requestCurrency(locale), exchangeRates()]);

  const routes: RouteData[] = [];
  const local = [];
  for (const p of places) {
    const d = p.details as TransportInfo;
    const from = cityKeyOf(d.from);
    const to = cityKeyOf(d.to);
    if ((SEARCH_MODES as readonly string[]).includes(d.mode) && from && to && from !== to) {
      routes.push({
        slug: p.slug,
        mode: d.mode as SearchMode,
        from,
        to,
        durationMin: d.durationMin,
        name: localize(p.name, locale),
        operator: t(`services.${serviceKey(d.mode, p.tags)}` as never),
        note: localize(d.scheduleNote, locale),
        image: p.image,
        classes: (
          d.classes ?? [
            {
              name: { en: "Standard", uz: "Standart", ru: "Стандарт" },
              priceFromUsd: p.priceFromUsd ?? 0,
            },
          ]
        ).map((c, i) => ({
          key: classKey(c.name.en, i),
          name: localize(c.name, locale),
          priceFromUsd: c.priceFromUsd,
        })),
      });
    } else {
      local.push(p);
    }
  }

  const cityKeys = connectedCities(routes);
  const cities = cityKeys.map((k) => ({
    key: k,
    label: t(`cities.${k}` as never),
  }));
  const minDate = tashkentDate(0);
  const rawDate = first(sp.date);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(rawDate)) && rawDate >= minDate ? rawDate : tashkentDate(1);
  const pax = Math.min(9, Math.max(1, Math.round(Number(first(sp.pax) ?? first(sp.passengers) ?? 1)) || 1));
  const cls = first(sp.class) === "business" ? "business" : "economy";
  let from = normalizeCity(first(sp.from)) ?? "tashkent";
  let to = normalizeCity(first(sp.to)) ?? (from === "samarkand" ? "bukhara" : from === "tashkent" ? "samarkand" : "tashkent");
  if (!cityKeys.includes(from)) from = "tashkent";
  if (!cityKeys.includes(to)) to = from === "samarkand" ? "bukhara" : "samarkand";
  const initial: SearchState = { from, to, date, pax, cls };

  const tips = [
    {
      icon: TrainFront,
      title: t("tips.trainsTitle"),
      text: t("tips.trainsText"),
    },
    { icon: TramFront, title: t("tips.metroTitle"), text: t("tips.metroText") },
    { icon: Car, title: t("tips.taxiTitle"), text: t("tips.taxiText") },
    { icon: Users, title: t("tips.sharedTitle"), text: t("tips.sharedText") },
    { icon: Plane, title: t("tips.flightsTitle"), text: t("tips.flightsText") },
    { icon: CreditCard, title: t("tips.payTitle"), text: t("tips.payText") },
  ];

  return (
    <ClientMessages namespaces={["placeCommon", "transportSearch", "monthsShort", "booking", "errors", "forms"]}>
      <PhotoHero
        locale={locale}
        image="/images/places/afrosiyob-samarkand.jpg"
        crumbLabel={tn("breadcrumb")}
        crumbs={[
          { name: tn("home"), href: "/" },
          { name: t("title"), href: "/transport" },
        ]}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
      >
        <div aria-hidden="true" className="h-8" />
      </PhotoHero>

      <div className="container-page relative z-10 -mt-10 pb-6">
        <TransportSearch
          routes={routes}
          cities={cities}
          initial={initial}
          minDate={minDate}
          locale={locale}
          currency={currency}
          rates={rates}
          action={getPathname({ locale, href: "/transport" })}
        />
      </div>

      <section className="container-page pt-8" aria-labelledby="popular-routes">
        <h2 id="popular-routes" className="text-2xl text-lapis">
          {t("popularTitle")}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR.filter(([a, b]) => cityKeys.includes(a) && cityKeys.includes(b)).map(([a, b]) => (
            <li key={`${a}-${b}`}>
              <Link
                href={{
                  pathname: "/transport",
                  query: { from: a, to: b, date, pax: String(pax) },
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-lapis-deep shadow-card hover:border-cobalt"
              >
                {t(`cities.${a}` as never)} <ArrowRight aria-hidden="true" className="size-4 text-saffron-ink" /> {t(`cities.${b}` as never)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page py-16" aria-labelledby="local-transport">
        <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-cobalt">
          {t("localEyebrow")}
          <span aria-hidden="true" className="h-px w-10 bg-cobalt/40" />
        </p>
        <h2 id="local-transport" className="mt-3 text-3xl text-lapis">
          {t("localTitle")}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">{t("localLead")}</p>

        <ul className="mt-8 grid gap-6 md:grid-cols-2">
          {local.map((p) => {
            const d = p.details as TransportInfo;
            const name = localize(p.name, locale);
            const fromPrice = d.classes?.length ? Math.min(...d.classes.map((c) => c.priceFromUsd)) : (p.priceFromUsd ?? 0);
            const perPerson = d.mode === "metro";
            return (
              <li
                key={p.slug}
                className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card sm:flex-row"
                data-testid="local-option"
              >
                <div className="relative aspect-[16/9] sm:aspect-auto sm:w-44 sm:shrink-0">
                  <SmartImage src={p.image} alt="" label={name} compact sizes="(min-width: 640px) 176px, 100vw" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-cobalt">{t(`modes.${d.mode}` as never)}</p>
                  <h3 className="text-xl text-lapis-deep">{name}</h3>
                  <p className="text-ink-muted">{localize(p.summary, locale)}</p>
                  <p className="text-sm text-ink">{localize(p.description, locale)}</p>
                  {d.classes && d.classes.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                      {d.classes.map((c, i) => (
                        <li key={i} className="rounded-full bg-sand-soft px-3 py-1 font-semibold">
                          {localize(c.name, locale)} · {formatUsdIn(c.priceFromUsd, currency, rates, locale)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="flex items-start gap-1.5 text-sm text-ink-muted">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {localize(d.scheduleNote, locale)}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    <AddToTripButton
                      size="sm"
                      tone="outline"
                      item={{
                        id: `transfer:${p.slug}`,
                        kind: "transfer",
                        title: name,
                        refSlug: p.slug,
                        destinationSlug: p.destinationSlug ?? CITY_DESTINATION.tashkent,
                        priceUsd: fromPrice,
                        priceUnit: perPerson ? "person" : "trip",
                        lat: p.lat ?? undefined,
                        lng: p.lng ?? undefined,
                        meta: localize(d.scheduleNote, locale),
                        image: p.image ?? undefined,
                      }}
                    />
                    {d.mode === "transfer" && (
                      <Link
                        href="/services/airport-transfer"
                        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-cobalt underline underline-offset-4 hover:text-lapis"
                      >
                        {t("bookTransfer")} <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h3 className="mt-14 text-2xl text-lapis">{t("tipsTitle")}</h3>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip) => (
            <li key={tip.title} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-sky text-cobalt">
                <tip.icon aria-hidden="true" className="size-5" />
              </span>
              <h4 className="mt-3 font-sans text-lg font-bold text-lapis-deep">{tip.title}</h4>
              <p className="mt-1 text-ink-muted">{tip.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </ClientMessages>
  );
}
