import { ArrowRight, CalendarDays, Map as MapIcon, Send, ShoppingBag, Wand2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listContent } from "@/db/queries/content";
import { listPublishedDestinations } from "@/db/queries/destinations";
import { listAttractions, listPlaces } from "@/db/queries/places";
import type { Locale, TransportDetails } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { formatUsdIn } from "@/lib/pricing";
import { db, exchangeRates, requestCurrency } from "@/lib/server/site";
import { addDaysIso, attractionToEntry, dayColor, estimateBudget, experienceToEntry, placeToEntry, type MetaFormat } from "@/lib/trip-helpers";
import type { TripItem } from "@/lib/trip-store";
import { todayInTashkent } from "@/validators/common";
import { KindIcon } from "./kind-icon";

const PREFERRED = ["samarkand", "bukhara"];

/** A three-day sample itinerary built from the live catalogue (real hotels, trains, sights and experiences we list). */
async function sampleTrip(locale: Locale, fmt: MetaFormat) {
  const all = await listPublishedDestinations(db());
  const local = all.filter((d) => !d.country);
  const picked = [...PREFERRED.map((s) => local.find((d) => d.slug === s)).filter(Boolean), ...local].filter((d, i, xs) => xs.indexOf(d) === i).slice(0, 2) as typeof local;
  if (picked.length < 2) return null;
  const [a, b] = picked as [(typeof local)[number], (typeof local)[number]];
  const [places, attrA, attrB, exp] = await Promise.all([
    listPlaces(db(), { destination: undefined }),
    listAttractions(db(), { destination: a.slug }),
    listAttractions(db(), { destination: b.slug }),
    listContent(db(), "experience", { destination: a.slug, limit: 1 }),
  ]);
  const placeIn = (kind: "hotel" | "restaurant", slug: string) => places.find((p) => p.kind === kind && p.destinationSlug === slug);
  /** A train (or flight) into `slug`, preferring one that departs from `from` (e.g. Samarkand → Bukhara on day 3). */
  const trainTo = (slug: string, from?: string) => {
    const legs = places.filter((p) => p.kind === "transport" && p.destinationSlug === slug && ["train", "flight"].includes((p.details as TransportDetails).mode));
    return (from && legs.find((p) => (p.details as TransportDetails).from?.toLowerCase().includes(from.toLowerCase()))) || legs[0];
  };
  const item = (x: TripItem | undefined | null, day: number) => (x ? { ...x, day } : null);
  const destA = { slug: a.slug, name: localize(a.name, locale), lat: a.lat, lng: a.lng };
  const rows = [
    item(trainTo(a.slug) && placeToEntry(trainTo(a.slug)!, locale, fmt), 1),
    item(attrA[0] && attractionToEntry(attrA[0], locale, destA.name), 1),
    item(placeIn("hotel", a.slug) && placeToEntry(placeIn("hotel", a.slug)!, locale, fmt), 1),
    item(exp[0] && experienceToEntry({ slug: exp[0].slug, title: localize(exp[0].title, locale), summary: "", image: exp[0].image, destinationSlug: exp[0].destinationSlug, priceUsd: exp[0].priceFromUsd, durationHours: exp[0].durationHours }, fmt, destA), 2),
    item(attrA[1] && attractionToEntry(attrA[1], locale, destA.name), 2),
    item(placeIn("restaurant", a.slug) && placeToEntry(placeIn("restaurant", a.slug)!, locale, fmt), 2),
    item(trainTo(b.slug, a.name.en) && placeToEntry(trainTo(b.slug, a.name.en)!, locale, fmt), 3),
    item(attrB[0] && attractionToEntry(attrB[0], locale, localize(b.name, locale)), 3),
    item(placeIn("hotel", b.slug) && placeToEntry(placeIn("hotel", b.slug)!, locale, fmt), 3),
  ].filter((x): x is NonNullable<typeof x> => !!x);
  if (rows.length < 4) return null;
  const start = addDaysIso(todayInTashkent(), 30);
  const budget = estimateBudget({ startDate: start, endDate: addDaysIso(start, 2), adults: 2, children: 0, destinations: [a.slug, b.slug], items: rows });
  return { rows, budget, names: [localize(a.name, locale), localize(b.name, locale)], dest: [a.slug, b.slug] };
}

/** Homepage section: how the Trip Constructor works, with a mini itinerary made from real catalogue data. */
export async function TripBuilderTeaser({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "tripBuilder.teaser" });
  const tu = await getTranslations({ locale, namespace: "tripBuilder.units" });
  const tk = await getTranslations({ locale, namespace: "tripBuilder.catalogue.kind" });
  const fmt: MetaFormat = {
    duration: (min) => {
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return h && m ? tu("durationHM", { h, m }) : h ? tu("durationH", { h }) : tu("durationM", { m });
    },
    hours: (n) => tu("hours", { n }),
    days: (n) => tu("days", { n }),
  };
  const [sample, currency, rates] = await Promise.all([sampleTrip(locale, fmt), requestCurrency(locale), exchangeRates()]);
  const money = (usd: number) => formatUsdIn(Math.round(usd), currency, rates, locale);
  const steps = [
    { key: "step1", Icon: CalendarDays },
    { key: "step2", Icon: ShoppingBag },
    { key: "step3", Icon: Wand2 },
    { key: "step4", Icon: Send },
  ] as const;

  return (
    <section aria-labelledby="trip-teaser-title" className="bg-girih-dark on-dark relative overflow-hidden py-16 text-white sm:py-20">
      <div className="container-page grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14">
        <div>
          <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-saffron">
            {t("eyebrow")}
            <span aria-hidden="true" className="h-px w-10 bg-saffron/50" />
          </p>
          <h2 id="trip-teaser-title" className="mt-3 text-3xl text-white">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/80">{t("text")}</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {steps.map(({ key, Icon }, i) => (
              <li key={key} className="flex gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-saffron text-lapis-deep">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.1em] text-saffron">{t("stepLabel", { n: i + 1 })}</span>
                  <span className="mt-0.5 block font-bold text-white">{t(`${key}.title`)}</span>
                  <span className="mt-0.5 block text-sm text-white/70">{t(`${key}.text`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={sample ? { pathname: "/trip-builder", query: { destination: sample.dest[0] } } : "/trip-builder"}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep transition hover:bg-saffron-soft"
            >
              {t("cta")} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/navigator" className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white ring-1 ring-white/40 transition hover:bg-white/10">
              <MapIcon aria-hidden="true" className="size-4" /> {t("mapCta")}
            </Link>
          </div>
        </div>

        {sample && (
          <div className="relative min-w-0">
            <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-cobalt/30 blur-2xl" />
            <figure className="relative overflow-hidden rounded-[1.75rem] bg-ivory text-ink shadow-lift">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-5 py-4">
                <span>
                  <span className="eyebrow block text-cobalt">{t("mockEyebrow")}</span>
                  <span className="mt-1 block font-extrabold text-lapis">{sample.names.join(" · ")}</span>
                </span>
                <span className="whitespace-nowrap rounded-full bg-sky px-3 py-1 text-xs font-bold text-lapis">{t("mockMeta", { days: 3, travellers: 2 })}</span>
              </figcaption>
              <ol className="space-y-4 px-5 py-4">
                {[1, 2, 3].map((d) => {
                  const list = sample.rows.filter((r) => r.day === d);
                  if (!list.length) return null;
                  return (
                    <li key={d}>
                      <p className="flex items-center gap-2 text-sm">
                        <span className="inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-extrabold text-white" style={{ background: dayColor(d) }}>
                          {t("dayN", { day: d })}
                        </span>
                        <span className="font-semibold text-ink-muted">{d < 3 ? sample.names[0] : sample.names[1]}</span>
                      </p>
                      <ul className="mt-2 space-y-1.5 border-l-2 pl-3" style={{ borderColor: dayColor(d) }}>
                        {list.map((r) => (
                          <li key={r.id} className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-[0_1px_0_rgb(23_61_102/0.06)]">
                            <KindIcon kind={r.kind} className="size-7 [&_svg]:size-3.5" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-lapis">{r.title}</span>
                              <span className="block truncate text-xs text-ink-muted">{tk(r.kind)}</span>
                            </span>
                            {r.priceUsd ? <span className="shrink-0 text-xs font-bold text-saffron-ink">{money(r.priceUsd)}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-center justify-between gap-3 bg-lapis-deep px-5 py-4 text-white">
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.1em] text-saffron">{t("mockTotal")}</span>
                  <span className="text-sm text-white/75">{t("mockPerPerson", { price: money(sample.budget.perPersonUsd) })}</span>
                </span>
                <span className="text-2xl font-extrabold">{money(sample.budget.totalUsd)}</span>
              </div>
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}
