"use client";

import { Loader2, PlusCircle, RotateCw, Sparkles, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/client/api";
import { dayColor, type CatalogEntry, type DestinationPoint } from "@/lib/trip-helpers";
import { addTripItem, type TripItem, type TripState } from "@/lib/trip-store";
import { AddToTripButton } from "./add-to-trip-button";

interface PlanDay {
  day: number;
  place: string;
  title: string;
  plan: string;
  transport: string | null;
  tourSlug: string | null;
}
interface Plan {
  title: string;
  summary: string;
  days: PlanDay[];
  tips: string[];
  generatedBy: "ai" | "catalogue";
}

const strip = ({ tab: _t, summary: _s, href: _h, ...item }: CatalogEntry): TripItem => item;

/** Catalogue items a planned day mentions (sights, experiences, its tour), else the top sights of the day's destination. */
function suggestionsFor(day: PlanDay, entries: CatalogEntry[], destinations: DestinationPoint[], dayCount: number, tripDestinations: string[]): TripItem[] {
  const text = `${day.place} ${day.title} ${day.plan}`.toLocaleLowerCase();
  // Partial name matches stay within the cities this day names, or else the trip's own destinations.
  const named = destinations.filter((d) => text.includes(d.name.toLocaleLowerCase())).map((d) => d.slug);
  const near = new Set(named.length ? named : tripDestinations);
  const destNames = destinations.map((d) => d.name.toLocaleLowerCase());
  const words = (title: string) => title.toLocaleLowerCase().split(/[\s,()]+/);
  // A short match ("Registan" for "Registan Square") is only trusted when no other sight shares the word ("mosque", "fortress"…).
  const seen = new Map<string, number>();
  for (const e of entries) if (e.kind === "attraction" || e.kind === "experience") for (const w of new Set(words(e.title))) seen.set(w, (seen.get(w) ?? 0) + 1);
  const out: CatalogEntry[] = [];
  if (day.tourSlug) {
    const tour = entries.find((e) => e.kind === "tour" && e.refSlug === day.tourSlug);
    if (tour) out.push(tour);
  }
  for (const e of entries) {
    if (e.kind !== "attraction" && e.kind !== "experience") continue;
    const name = e.title.toLocaleLowerCase();
    const core = e.kind === "attraction" ? words(e.title).find((w) => w.length >= 5 && !destNames.includes(w) && seen.get(w) === 1) : undefined;
    if (text.includes(name) || (core && e.destinationSlug && near.has(e.destinationSlug) && text.includes(core))) out.push(e);
  }
  if (out.length === 0) {
    const dest = destinations.find((d) => text.includes(d.name.toLocaleLowerCase()) || text.includes(d.slug.replace(/-/g, " ")));
    if (dest) out.push(...entries.filter((e) => e.kind === "attraction" && e.destinationSlug === dest.slug).slice(0, 2));
  }
  const day1 = Math.min(dayCount, Math.max(1, day.day));
  return [...new Map(out.map((e) => [e.id, e])).values()].slice(0, 4).map((e) => ({ ...strip(e), day: day1 }));
}

/**
 * A plan drafted from the catalogue (no AI available) leaves days without a tour empty. Give each such day a destination,
 * in the trip's order, with the next sights and an experience there, so every day has something to add.
 */
function fillFreeDays(plan: Plan, order: string[], entries: CatalogEntry[], destinationName: (slug: string) => string, title: (place: string) => string): Plan {
  if (plan.generatedBy !== "catalogue" || order.length === 0) return plan;
  const cursor = new Map<string, number>();
  const take = (slug: string, kind: "attraction" | "experience", n: number) => {
    const list = entries.filter((e) => e.kind === kind && e.destinationSlug === slug);
    const key = `${kind}:${slug}`;
    const from = cursor.get(key) ?? 0;
    cursor.set(key, from + n);
    return list.slice(from, from + n);
  };
  const days = plan.days.map((d, i) => {
    if (d.tourSlug || d.plan.trim()) return d;
    const slug = order[Math.min(order.length - 1, Math.floor((i * order.length) / plan.days.length))]!;
    const picks = [...take(slug, "attraction", 2), ...take(slug, "experience", 1)];
    if (picks.length === 0) return d;
    const place = destinationName(slug);
    return { ...d, place, title: title(place), plan: picks.map((e) => e.title).join(" · ") };
  });
  return { ...plan, days };
}

export function BuilderAi({
  trip,
  dayCount,
  entries,
  destinations,
  destinationName,
}: {
  trip: TripState;
  dayCount: number;
  entries: CatalogEntry[];
  destinations: DestinationPoint[];
  destinationName: (slug: string) => string;
}) {
  const t = useTranslations("tripBuilder.ai");
  const locale = useLocale() as Locale;
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; plan?: Plan; planId?: string; error?: string }>({ status: "idle" });
  const canAsk = trip.destinations.length > 0 || trip.items.length > 0;

  const ask = async () => {
    setState({ status: "loading" });
    const names = [...new Set([...trip.destinations, ...trip.items.map((i) => i.destinationSlug).filter(Boolean)])].map((s) => destinationName(s as string)).slice(0, 8);
    const chosen = trip.items.slice(0, 25).map((i) => i.title).join("; ");
    const parts = [
      t("request.base", { days: dayCount, places: names.join(", ") || t("request.anywhere"), adults: trip.adults, children: trip.children }),
      trip.startDate && trip.endDate ? t("request.dates", { start: trip.startDate, end: trip.endDate }) : "",
      chosen ? t("request.items", { items: chosen }) : "",
      t("request.ask"),
    ].filter(Boolean);
    const request = parts.join(" ").slice(0, 1500);
    const r = await apiFetch<{ id: string; plan: Plan }>("/api/ai/planner", {
      method: "POST",
      json: { request, locale, days: Math.min(21, Math.max(1, dayCount)), destinations: names.map((n) => n.slice(0, 40)) },
    });
    const order = [...new Set([...trip.destinations, ...trip.items.map((i) => i.destinationSlug).filter((s): s is string => !!s)])];
    if (r.ok && r.data.plan?.days?.length)
      setState({ status: "done", plan: fillFreeDays(r.data.plan, order, entries, destinationName, (place) => t("exploreDay", { place })), planId: r.data.id });
    else setState({ status: "error", error: !r.ok && r.status === 429 ? t("busy") : !r.ok && r.error.code === "network_error" ? t("network") : t("error") });
  };

  const tripDestinations = trip.destinations;
  const suggestions = useMemo(() => {
    if (!state.plan) return [];
    // A multi-day tour is suggested once, on the first day it appears.
    const seen = new Set<string>();
    return state.plan.days.map((d) =>
      suggestionsFor(d, entries, destinations, dayCount, tripDestinations).filter((s) => {
        if (s.kind !== "tour") return true;
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      }),
    );
  }, [state.plan, entries, destinations, dayCount, tripDestinations]);
  const inTrip = new Set(trip.items.map((i) => i.id));
  const pending = suggestions.flat().filter((s, i, all) => !inTrip.has(s.id) && all.findIndex((x) => x.id === s.id) === i);

  return (
    <section aria-labelledby="tb-ai" className="card overflow-hidden">
      <div className="bg-ai-soft flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-2xl">
          <p className="eyebrow flex items-center gap-2 text-cobalt">
            <Sparkles aria-hidden="true" className="size-4" /> {t("eyebrow")}
          </p>
          <h2 id="tb-ai" className="mt-1.5 text-2xl text-lapis">
            {t("title")}
          </h2>
          <p className="mt-1 text-ink/75">{t("text")}</p>
        </div>
        <button
          type="button"
          onClick={ask}
          disabled={!canAsk || state.status === "loading"}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lapis px-6 font-bold text-white transition hover:bg-cobalt disabled:opacity-55"
        >
          {state.status === "loading" ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Wand2 aria-hidden="true" className="size-5" />}
          {state.status === "done" ? t("again") : t("cta")}
        </button>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {!canAsk && state.status === "idle" && <p className="px-5 pb-5 pt-4 text-sm text-ink-muted sm:px-6">{t("needInput")}</p>}
        {state.status === "loading" && (
          <div className="space-y-3 p-5 sm:p-6" aria-busy="true">
            <p className="text-sm font-semibold text-lapis">{t("loading")}</p>
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        )}
        {state.status === "error" && (
          <div role="alert" className="m-5 rounded-2xl bg-danger/5 p-4 text-ink ring-1 ring-danger/20 sm:m-6">
            <p>{state.error}</p>
            <button type="button" onClick={ask} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-lapis ring-1 ring-line hover:bg-sky">
              <RotateCw aria-hidden="true" className="size-4" /> {t("retry")}
            </button>
          </div>
        )}
        {state.status === "done" && state.plan && (
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <h3 className="text-xl text-lapis">{state.plan.title}</h3>
                {state.plan.generatedBy === "catalogue" ? (
                  <p className="mt-1 text-sm text-ink/75">{t("fromCatalogue")}</p>
                ) : (
                  state.plan.summary && <p className="mt-1 text-sm text-ink/75">{state.plan.summary}</p>
                )}
              </div>
              {pending.length > 0 && (
                <button
                  type="button"
                  onClick={() => pending.forEach((s) => addTripItem(s))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-5 text-sm font-bold text-lapis-deep hover:bg-saffron-soft"
                >
                  <PlusCircle aria-hidden="true" className="size-4" /> {t("addAll", { count: pending.length })}
                </button>
              )}
            </div>
            <ol className="mt-5 grid gap-3 md:grid-cols-2">
              {state.plan.days.map((d, i) => (
                <li key={`${d.day}-${i}`} className="rounded-2xl border border-line bg-white p-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex min-h-7 items-center rounded-full px-2.5 font-extrabold text-white" style={{ background: dayColor(Math.min(dayCount, d.day)) }}>
                      {t("dayN", { day: d.day })}
                    </span>
                    {d.place && <span className="font-semibold text-ink-muted">{d.place}</span>}
                  </p>
                  <h4 className="mt-2 font-extrabold leading-snug text-lapis">{d.title}</h4>
                  {d.plan && <p className="mt-1 line-clamp-5 text-sm text-ink/80">{d.plan}</p>}
                  {d.transport && <p className="mt-1 text-xs text-ink-muted">{d.transport}</p>}
                  {suggestions[i]!.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{t("suggested")}</p>
                      <ul className="mt-2 space-y-2">
                        {suggestions[i]!.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 text-sm font-semibold text-ink">{s.title}</span>
                            <AddToTripButton {...s} size="sm" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {state.plan.tips.length > 0 && (
              <ul className="check-list mt-5 space-y-1.5 text-sm text-ink/80">
                {state.plan.tips.slice(0, 3).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
            {state.planId && (
              <Link href={{ pathname: "/planner", query: { plan: state.planId } }} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-cobalt underline-offset-4 hover:underline">
                {t("openPlanner")}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
