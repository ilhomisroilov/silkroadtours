"use client";

import { ArrowLeftRight, ArrowRight, Bus, Car, Clock, Plane, Search, TrainFront, Users, Zap, BadgeDollarSign, Sunrise } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/form";
import type { Currency, ExchangeRates, Locale } from "@/db/types";
import { cn } from "@/lib/cn";
import {
  CITY_DESTINATION,
  perVehicle,
  pickFare,
  searchDepartures,
  timeOfDay,
  type CityKey,
  type Departure,
  type RouteData,
  type SearchMode,
  type TimeOfDay,
} from "@/lib/places/schedule";
import { formatUsdIn } from "@/lib/pricing";
import type { TripItemKind } from "@/lib/trip-store";
import { AddToTripButton } from "./add-to-trip-button";
import { PlaceInquiryForm } from "./place-inquiry-form";

export interface SearchState {
  from: CityKey;
  to: CityKey;
  date: string;
  pax: number;
  cls: "economy" | "business";
}

const MODE_ICON: Record<SearchMode, typeof TrainFront> = {
  train: TrainFront,
  flight: Plane,
  bus: Bus,
  shared_taxi: Car,
  car: Car,
};
const TIMES: (TimeOfDay | "")[] = ["", "morning", "afternoon", "evening", "night"];
type Sort = "departure" | "price" | "duration";

const tripKind = (m: SearchMode): TripItemKind => (m === "train" ? "train" : m === "flight" ? "flight" : "transfer");

/**
 * Flights & trains search: origin, destination, date, passengers and class; typical departures for the date
 * with filters, sorting and a small comparison. Fares are indicative and confirmed by the travel manager.
 */
export function TransportSearch({
  routes,
  cities,
  initial,
  minDate,
  locale,
  currency,
  rates,
  action,
}: {
  routes: RouteData[];
  cities: { key: CityKey; label: string }[];
  initial: SearchState;
  minDate: string;
  locale: Locale;
  currency: Currency;
  rates: ExchangeRates;
  /** Localized /transport URL for the no-JavaScript GET form. */
  action: string;
}) {
  const t = useTranslations("transportSearch");
  const tm = useTranslations("monthsShort");
  const [form, setForm] = useState<SearchState>(initial);
  const [query, setQuery] = useState<SearchState>(initial);
  const [mode, setMode] = useState<SearchMode | "">("");
  const [time, setTime] = useState<TimeOfDay | "">("");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("departure");
  const [request, setRequest] = useState<{
    d: Departure;
    summary: string;
    subject: string;
  } | null>(null);

  const cityLabel = (k: CityKey) => cities.find((c) => c.key === k)?.label ?? k;
  const routeBySlug = useMemo(() => new Map(routes.map((r) => [r.slug, r])), [routes]);
  const money = (usd: number) => formatUsdIn(usd, currency, rates, locale);
  const dur = (min: number) =>
    t("duration", {
      h: Math.floor(min / 60),
      m: String(min % 60).padStart(2, "0"),
    });
  const dateLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${t(`weekdays.${d.getUTCDay()}` as never)}, ${d.getUTCDate()} ${tm(String(d.getUTCMonth() + 1) as never)}`;
  };

  const all = useMemo(() => searchDepartures(routes, query.from, query.to, query.date), [routes, query.from, query.to, query.date]);
  const priced = all.map((d) => ({ d, fare: pickFare(d, query.cls)! })).filter((x) => x.fare);
  const total = (x: { d: Departure; fare: { priceUsd: number } }) => (perVehicle(x.d.mode) ? x.fare.priceUsd : x.fare.priceUsd * query.pax);
  const modes = [...new Set(all.map((d) => d.mode))];
  const priceCap = priced.length ? Math.max(...priced.map((x) => x.fare.priceUsd)) : 0;
  const shown = priced
    .filter((x) => (!mode || x.d.mode === mode) && (!time || timeOfDay(x.d.depMin) === time) && (maxPrice == null || x.fare.priceUsd <= maxPrice))
    .sort(
      (a, b) =>
        (sort === "price" ? total(a) - total(b) : sort === "duration" ? a.d.durationMin - b.d.durationMin : a.d.depMin - b.d.depMin) || a.d.depMin - b.d.depMin,
    );
  const cheapest = priced.length ? priced.reduce((a, b) => (total(b) < total(a) ? b : a)) : null;
  const fastest = priced.length ? priced.reduce((a, b) => (b.d.durationMin < a.d.durationMin ? b : a)) : null;
  const earliest = priced.length ? priced.reduce((a, b) => (b.d.depMin < a.d.depMin ? b : a)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(form);
    setMode("");
    setTime("");
    setMaxPrice(null);
    const qs = new URLSearchParams({
      from: form.from,
      to: form.to,
      date: form.date,
      pax: String(form.pax),
      class: form.cls,
    });
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${qs.toString()}#results`);
    } catch {
      /* the results still update without the URL */
    }
    document.getElementById("results")?.focus({ preventScroll: true });
  };
  const swap = () => setForm((f) => ({ ...f, from: f.to, to: f.from }));
  const modeLabel = (m: SearchMode) => t(`modes.${m}` as never);

  const field = "block min-h-12 w-full rounded-xl border border-field bg-white px-3.5 text-[0.95rem] font-semibold text-ink focus-visible:border-cobalt";

  return (
    <div>
      <form
        action={action}
        method="get"
        role="search"
        aria-label={t("formLabel")}
        onSubmit={submit}
        className="grid gap-3 rounded-[1.5rem] bg-white p-4 text-ink shadow-lift sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_10rem_7rem_9rem_auto] lg:items-end lg:p-5"
        data-testid="transport-form"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("from")}</span>
          <NativeSelect
            name="from"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value as CityKey })}
            className="min-h-12 rounded-xl font-semibold"
          >
            {cities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button
          type="button"
          onClick={swap}
          aria-label={t("swap")}
          className="inline-flex size-12 items-center justify-center justify-self-center rounded-full border border-field text-cobalt hover:bg-sky sm:hidden lg:inline-flex"
        >
          <ArrowLeftRight aria-hidden="true" className="size-5" />
        </button>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("to")}</span>
          <NativeSelect
            name="to"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value as CityKey })}
            className="min-h-12 rounded-xl font-semibold"
          >
            {cities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("date")}</span>
          <input
            type="date"
            name="date"
            min={minDate}
            value={form.date}
            required
            onChange={(e) => setForm({ ...form, date: e.target.value || form.date })}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("passengers")}</span>
          <NativeSelect
            name="pax"
            value={form.pax}
            onChange={(e) => setForm({ ...form, pax: Number(e.target.value) })}
            className="min-h-12 rounded-xl font-semibold"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("class")}</span>
          <NativeSelect
            name="class"
            value={form.cls}
            onChange={(e) => setForm({ ...form, cls: e.target.value as SearchState["cls"] })}
            className="min-h-12 rounded-xl font-semibold"
          >
            <option value="economy">{t("classes.economy")}</option>
            <option value="business">{t("classes.business")}</option>
          </NativeSelect>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lapis-deep px-6 font-bold text-white hover:bg-cobalt sm:col-span-2 lg:col-span-1"
          data-testid="transport-submit"
        >
          <Search aria-hidden="true" className="size-5" /> {t("search")}
        </button>
      </form>

      <section id="results" tabIndex={-1} aria-labelledby="results-title" className="mt-10 scroll-mt-24 outline-none">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-title" className="text-3xl text-lapis">
              {cityLabel(query.from)} <ArrowRight aria-hidden="true" className="inline size-6 text-saffron-ink" />
              <span className="sr-only">→</span> {cityLabel(query.to)}
            </h2>
            <p className="mt-1 text-ink-muted" aria-live="polite" data-testid="transport-count">
              {dateLabel(query.date)} · {t("paxCount", { count: query.pax })} · {t(`classes.${query.cls}`)} · {t("resultsCount", { count: shown.length })}
            </p>
          </div>
          {priced.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-ink-muted">{t("sortLabel")}</span>
              <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto min-w-40 rounded-full py-2 text-sm font-semibold">
                <option value="departure">{t("sort.departure")}</option>
                <option value="price">{t("sort.price")}</option>
                <option value="duration">{t("sort.duration")}</option>
              </NativeSelect>
            </label>
          )}
        </div>

        {priced.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-sand-soft/60 p-6 sm:p-8">
            <h3 className="text-2xl text-lapis-deep">{t("noRouteTitle")}</h3>
            <p className="mt-2 max-w-2xl text-ink-muted">
              {t("noRouteText", {
                from: cityLabel(query.from),
                to: cityLabel(query.to),
              })}
            </p>
            <button
              type="button"
              onClick={() =>
                setRequest({
                  d: {
                    id: "custom",
                    slug: "",
                    mode: "car",
                    from: query.from,
                    to: query.to,
                    dep: "",
                    arr: "",
                    depMin: 0,
                    arrDays: 0,
                    durationMin: 0,
                    fares: [],
                  },
                  subject: `Transport: ${query.from} → ${query.to}`,
                  summary: `${cityLabel(query.from)} → ${cityLabel(query.to)} · ${query.date} · ${t("paxCount", { count: query.pax })}`,
                })
              }
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-lapis-deep px-5 text-sm font-bold text-white hover:bg-cobalt"
            >
              {t("askManager")}
            </button>
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3" aria-label={t("compareLabel")}>
              {[
                {
                  k: "cheapest",
                  x: cheapest,
                  icon: BadgeDollarSign,
                  value: cheapest ? (
                    <>
                      {money(cheapest.fare.priceUsd)}{" "}
                      <span className="text-sm font-semibold text-ink-muted">{perVehicle(cheapest.d.mode) ? t("perVehicle") : t("perPerson")}</span>
                    </>
                  ) : (
                    ""
                  ),
                  sortTo: "price" as Sort,
                },
                {
                  k: "fastest",
                  x: fastest,
                  icon: Zap,
                  value: fastest ? dur(fastest.d.durationMin) : "",
                  sortTo: "duration" as Sort,
                },
                {
                  k: "earliest",
                  x: earliest,
                  icon: Sunrise,
                  value: earliest ? earliest.d.dep : "",
                  sortTo: "departure" as Sort,
                },
              ].map(({ k, x, icon: Icon, value, sortTo }) =>
                x ? (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setSort(sortTo)}
                      aria-pressed={sort === sortTo}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-cobalt",
                        sort === sortTo ? "border-cobalt ring-2 ring-cobalt/30" : "border-line",
                      )}
                    >
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sky text-cobalt">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold uppercase tracking-wide text-ink-muted">{t(`compare.${k}` as never)}</span>
                        <span className="block text-lg font-extrabold text-lapis">{value}</span>
                        <span className="block truncate text-sm text-ink-muted">
                          {modeLabel(x.d.mode)} · {x.d.dep}
                        </span>
                      </span>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>

            <div className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-sand-soft/70 p-4">
              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("modeFilter")}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["", ...modes] as (SearchMode | "")[]).map((m) => (
                    <button
                      key={m || "all"}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
                        mode === m ? "border-lapis-deep bg-lapis-deep text-white" : "border-field bg-white text-ink hover:border-cobalt",
                      )}
                    >
                      {m ? modeLabel(m) : t("allModes")}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-muted">{t("timeFilter")}</span>
                <NativeSelect
                  value={time}
                  onChange={(e) => setTime(e.target.value as TimeOfDay | "")}
                  className="min-h-10 rounded-full py-1.5 text-sm font-semibold"
                >
                  {TIMES.map((x) => (
                    <option key={x || "any"} value={x}>
                      {t(`times.${x || "any"}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {priceCap > 0 && (
                <label className="block min-w-48 flex-1 sm:max-w-72">
                  <span className="mb-1.5 flex justify-between text-xs font-bold uppercase tracking-wide text-ink-muted">
                    <span>{t("maxPrice")}</span>
                    <span className="normal-case text-lapis">{money(maxPrice ?? priceCap)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={priceCap}
                    step={1}
                    value={maxPrice ?? priceCap}
                    onChange={(e) => setMaxPrice(Number(e.target.value) >= priceCap ? null : Number(e.target.value))}
                    className="h-10 w-full accent-[var(--color-lapis)]"
                    aria-valuetext={money(maxPrice ?? priceCap)}
                  />
                </label>
              )}
            </div>

            {shown.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-ink-muted">{t("noMatch")}</p>
            ) : (
              <ul className="mt-6 space-y-4" data-testid="departures">
                {shown.map(({ d, fare }) => {
                  const r = routeBySlug.get(d.slug)!;
                  const Icon = MODE_ICON[d.mode];
                  const vehicle = perVehicle(d.mode);
                  const route = `${cityLabel(d.from)} → ${cityLabel(d.to)}`;
                  const meta = `${dateLabel(query.date)} · ${d.dep} → ${d.arr}${d.arrDays ? ` (+${d.arrDays})` : ""} · ${fare.name}`;
                  return (
                    <li key={d.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-card sm:p-5" data-testid="departure">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <span className="mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky text-cobalt">
                            <Icon aria-hidden="true" className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-xl font-extrabold tabular-nums text-lapis-deep sm:text-2xl">{d.dep}</span>
                              <span className="flex min-w-10 flex-1 items-center justify-center gap-2 text-[0.7rem] font-semibold text-ink-muted sm:text-xs">
                                <span aria-hidden="true" className="hidden h-px flex-1 bg-line min-[400px]:block" />
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                  <Clock aria-hidden="true" className="size-3.5" /> {dur(d.durationMin)}
                                </span>
                                <span aria-hidden="true" className="hidden h-px flex-1 bg-line min-[400px]:block" />
                              </span>
                              <span className="whitespace-nowrap text-xl font-extrabold tabular-nums text-lapis-deep sm:text-2xl">
                                {d.arr}
                                {d.arrDays > 0 && <sup className="ml-0.5 text-xs font-bold text-terracotta">+{d.arrDays}</sup>}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-ink">
                              {r.operator}
                            </p>
                            <p className="text-sm text-ink-muted">
                              {route}
                              {d.arrDays > 0 && <> · {t("nextDay")}</>}
                            </p>
                            {d.fares.length > 1 && (
                              <p className="mt-1 text-xs text-ink-muted">{d.fares.map((f) => `${f.name} ${money(f.priceUsd)}`).join(" · ")}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 lg:w-80 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                          <p className="leading-tight lg:text-right">
                            <span className="block text-xs uppercase tracking-wide text-ink-muted">
                              {fare.name} · {vehicle ? t("perVehicle") : t("perPerson")}
                            </span>
                            <span className="text-2xl font-extrabold text-lapis">{money(fare.priceUsd)}</span>
                            {!vehicle && query.pax > 1 && (
                              <span className="block text-xs text-ink-muted">
                                {t("totalFor", {
                                  total: money(fare.priceUsd * query.pax),
                                  count: query.pax,
                                })}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <AddToTripButton
                              size="sm"
                              showViewLink={false}
                              item={{
                                id: `${tripKind(d.mode)}:${d.id}`,
                                kind: tripKind(d.mode),
                                title: `${route} · ${r.operator}`,
                                refSlug: d.slug,
                                destinationSlug: CITY_DESTINATION[d.to],
                                priceUsd: fare.priceUsd,
                                priceUnit: vehicle ? "trip" : "person",
                                meta,
                                image: r.image ?? undefined,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setRequest({
                                  d,
                                  subject: `Transport: ${d.from} → ${d.to}, ${query.date} ${d.dep} (${d.mode})`,
                                  summary: `${route} · ${r.operator}\n${meta} · ${money(fare.priceUsd)} ${vehicle ? t("perVehicle") : t("perPerson")}`,
                                })
                              }
                              className="inline-flex min-h-10 items-center rounded-full border border-lapis-deep px-4 text-sm font-bold text-lapis-deep hover:bg-lapis-deep hover:text-white"
                              data-testid="request-departure"
                            >
                              {t("requestThis")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted">
          <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("indicativeNote")}
        </p>
      </section>

      <Dialog open={!!request} onOpenChange={(o) => !o && setRequest(null)}>
        <DialogContent closeLabel={t("close")} className="max-w-xl">
          <DialogTitle className="pr-10 text-2xl text-lapis-deep">{t("requestTitle")}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-muted">{t("requestLead")}</DialogDescription>
          {request && (
            <div className="mt-5">
              <PlaceInquiryForm
                topic="transport"
                refSlug={request.d.slug || undefined}
                subject={request.subject}
                summary={request.summary}
                defaults={{ date: query.date, guests: query.pax }}
                idPrefix="transport"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
