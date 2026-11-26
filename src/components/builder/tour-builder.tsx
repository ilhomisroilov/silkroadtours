"use client";

import { ArrowDown, ArrowUp, Check, Minus, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SmartImage } from "@/components/common/smart-image";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import type { Currency, ExchangeRates, Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { convertMinor, formatMoney, roundToDisplayStep } from "@/lib/pricing";
import { todayInTashkent } from "@/validators/common";
import { ACCOMMODATION_LEVELS, INTERESTS } from "@/validators/service-request";

export type BuilderPlace = { slug: string; name: string; country: string | null; image: string | null; rates: number[] | null };
export type BuilderExperience = { slug: string; title: string; place: string; priceUsd: number };
type Stop = { slug: string; nights: number };
type Level = (typeof ACCOMMODATION_LEVELS)[number];

/** Hotel level relative to the comfort-level hotels our tour prices are based on. */
const LEVEL_FACTOR: Record<Level, number> = { budget: 0.85, comfort: 1, boutique: 1.2, luxury: 1.5 };
const CHILD_FACTOR = 0.7;
const MAX_STOPS = 9;
const SUGGESTIONS: { key: string; stops: Stop[] }[] = [
  { key: "classic", stops: [{ slug: "tashkent", nights: 1 }, { slug: "samarkand", nights: 2 }, { slug: "bukhara", nights: 2 }, { slug: "khiva", nights: 2 }] },
  { key: "short", stops: [{ slug: "samarkand", nights: 2 }, { slug: "bukhara", nights: 2 }] },
  { key: "nature", stops: [{ slug: "tashkent", nights: 1 }, { slug: "chimgan-charvak", nights: 2 }, { slug: "aydarkul", nights: 1 }, { slug: "samarkand", nights: 2 }] },
];

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const tc = useTranslations("common");
  const btn = "inline-flex size-9 items-center justify-center rounded-full bg-sky text-cobalt transition hover:bg-cobalt hover:text-white disabled:opacity-40 disabled:hover:bg-sky disabled:hover:text-cobalt";
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={tc("decrease", { label })}>
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <span className="min-w-6 text-center text-lg font-extrabold text-lapis" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={tc("increase", { label })}>
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function TourBuilder({
  places,
  overall,
  experiences,
  currency,
  rates,
}: {
  places: BuilderPlace[];
  overall: number[];
  experiences: BuilderExperience[];
  currency: Currency;
  rates: ExchangeRates;
}) {
  const t = useTranslations("nt.builderPage");
  const ts = useTranslations("services");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const bySlug = useMemo(() => new Map(places.map((p) => [p.slug, p])), [places]);

  const [route, setRoute] = useState<Stop[]>([]);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [level, setLevel] = useState<Level>("comfort");
  const [interests, setInterests] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [wishes, setWishes] = useState("");

  const inRoute = (slug: string) => route.some((s) => s.slug === slug);
  const toggle = (slug: string) =>
    setRoute((r) => (r.some((s) => s.slug === slug) ? r.filter((s) => s.slug !== slug) : r.length >= MAX_STOPS ? r : [...r, { slug, nights: 2 }]));
  const move = (i: number, d: -1 | 1) =>
    setRoute((r) => {
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  const setNights = (i: number, nights: number) => setRoute((r) => r.map((s, k) => (k === i ? { ...s, nights } : s)));

  const pax = adults + children;
  const rateAt = (slug: string): number => {
    const series = bySlug.get(slug)?.rates ?? overall;
    return series[Math.min(pax, series.length) - 1] ?? 0;
  };
  const totalNights = route.reduce((a, s) => a + s.nights, 0);
  const totalDays = route.length ? totalNights + 1 : 0;
  const lines = route.map((s, i) => ({ ...s, name: bySlug.get(s.slug)?.name ?? s.slug, usd: rateAt(s.slug) * (s.nights + (i === 0 ? 1 : 0)) * LEVEL_FACTOR[level] }));
  const placesPerAdult = lines.reduce((a, l) => a + l.usd, 0);
  const availableExtras = experiences.filter((e) => route.some((s) => s.slug === e.place));
  const chosenExtras = availableExtras.filter((e) => extras.includes(e.slug));
  const extrasPerPerson = chosenExtras.reduce((a, e) => a + e.priceUsd, 0);
  const perAdult = placesPerAdult + extrasPerPerson;
  const groupTotal = placesPerAdult * (adults + children * CHILD_FACTOR) + extrasPerPerson * pax;

  const money = (usd: number) => {
    try {
      return formatMoney(roundToDisplayStep(convertMinor(Math.round(usd * 100), "USD", currency, rates), currency), currency, locale);
    } catch {
      return formatMoney(Math.round(usd) * 100, "USD", locale);
    }
  };
  const range = (usd: number) => `${money(usd * 0.9)} – ${money(usd * 1.15)}`;

  const endDate = useMemo(() => {
    if (!startDate || !totalNights) return "";
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + totalNights);
    return d.toISOString().slice(0, 10);
  }, [startDate, totalNights]);
  const ready = route.length > 0 && !!startDate && startDate > todayInTashkent();

  const preset = useMemo(() => {
    const routeText = route.map((s) => `${bySlug.get(s.slug)?.name ?? s.slug} (${tc("nights", { count: s.nights })})`).join(" → ");
    const parts = [
      `${t("notesRoute")}: ${routeText}`,
      chosenExtras.length ? `${t("notesExtras")}: ${chosenExtras.map((e) => e.title).join(", ")}` : null,
      perAdult > 0 ? `${t("notesEstimate")}: ${range(perAdult)}` : null,
      wishes.trim() ? `${t("notesWishes")}: ${wishes.trim()}` : null,
    ].filter(Boolean);
    return {
      startDate,
      endDate,
      adults,
      children,
      destinationSlugs: route.map((s) => s.slug),
      interests,
      accommodationLevel: level,
      budgetPerPersonUsd: perAdult > 0 ? Math.round(perAdult) : undefined,
      notes: parts.join("\n").slice(0, 3000),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, startDate, endDate, adults, children, interests, level, perAdult, wishes, chosenExtras.length]);

  const card = "rounded-[1.5rem] bg-white p-5 shadow-card sm:p-6";
  const stepTitle = (n: number, text: string) => (
    <h2 className="flex items-center gap-3 text-xl text-lapis">
      <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-lapis text-sm font-extrabold text-white">{n}</span>
      {text}
    </h2>
  );
  const groups = [
    { label: t("uzbekistan"), items: places.filter((p) => !p.country) },
    { label: t("abroad"), items: places.filter((p) => p.country) },
  ].filter((g) => g.items.length > 0);

  const estimate = (
    <div className="rounded-[1.5rem] bg-lapis p-6 text-white shadow-lift">
      <p className="text-sm font-bold uppercase tracking-[0.1em] text-saffron">{t("estimateTitle")}</p>
      {route.length === 0 ? (
        <p className="mt-3 text-white/80">{t("estimateEmpty")}</p>
      ) : (
        <>
          <p className="mt-3 text-[1.7rem] font-extrabold leading-tight">{range(perAdult)}</p>
          <p className="text-sm text-white/75">{tc("perPerson")} · {t("daysNights", { days: totalDays, nights: totalNights })}</p>
          <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
            {lines.map((l) => (
              <div key={l.slug} className="flex justify-between gap-3">
                <dt className="text-white/80">{l.name} · {tc("nights", { count: l.nights })}</dt>
                <dd className="font-semibold">{money(l.usd)}</dd>
              </div>
            ))}
            {chosenExtras.map((e) => (
              <div key={e.slug} className="flex justify-between gap-3">
                <dt className="text-white/80">{e.title}</dt>
                <dd className="font-semibold">{money(e.priceUsd)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-white/15 pt-3 text-base">
              <dt>{t("forGroup", { count: pax })}</dt>
              <dd className="font-extrabold">{range(groupTotal)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-white/70">{t("estimateNote")}{children > 0 ? ` ${t("childrenNote")}` : ""}</p>
          <a href="#send" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-saffron px-5 font-bold text-lapis-deep hover:bg-[#e6b55a]">
            {t("sendCta")}
          </a>
        </>
      )}
      <Link href="/planner" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/30 px-5 text-sm font-bold text-white hover:bg-white/10">
        <Wand2 aria-hidden="true" className="size-4" /> {t("askAi")}
      </Link>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-6">
        {/* 1. Places */}
        <section className={card} aria-labelledby="b-step1">
          <div id="b-step1">{stepTitle(1, t("step1"))}</div>
          <p className="mt-2 text-sm text-ink-muted">{t("step1Hint", { max: MAX_STOPS })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="self-center text-sm font-semibold text-ink-muted">{t("suggestions")}:</span>
            {SUGGESTIONS.filter((s) => s.stops.every((x) => bySlug.has(x.slug))).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setRoute(s.stops)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sky px-4 text-sm font-semibold text-lapis transition hover:bg-cobalt hover:text-white"
              >
                <Sparkles aria-hidden="true" className="size-4" /> {t(`suggestion.${s.key}` as never)}
              </button>
            ))}
          </div>
          {groups.map((g) => (
            <fieldset key={g.label} className="mt-5">
              <legend className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-cobalt">{g.label}</legend>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {g.items.map((p) => {
                  const on = inRoute(p.slug);
                  return (
                    <li key={p.slug}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(p.slug)}
                        className={`group relative block w-full overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-cobalt" : "ring-transparent hover:ring-cobalt/40"}`}
                      >
                        <span className="block aspect-[4/3]">
                          <SmartImage src={p.image} alt="" label={p.name} compact sizes="(min-width: 1024px) 15vw, 45vw" />
                        </span>
                        <span className="absolute inset-0 bg-gradient-to-t from-lapis-deep/85 via-lapis-deep/10 to-transparent" />
                        <span className="absolute inset-x-2.5 bottom-2 text-sm font-bold leading-tight text-white">
                          {p.name}
                          {p.country && <span className="block text-xs font-medium text-white/80">{p.country}</span>}
                        </span>
                        <span className={`absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full ${on ? "bg-cobalt text-white" : "bg-white/85 text-lapis"}`}>
                          {on ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </section>

        {/* 2. Route */}
        <section className={card} aria-labelledby="b-step2">
          <div id="b-step2">{stepTitle(2, t("step2"))}</div>
          {route.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-sky/60 p-4 text-ink/80">{t("routeEmpty")}</p>
          ) : (
            <>
              <ol className="mt-4 space-y-3">
                {route.map((s, i) => {
                  const p = bySlug.get(s.slug);
                  return (
                    <li key={s.slug} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky text-sm font-extrabold text-cobalt">{i + 1}</span>
                      <span className="min-w-0 flex-1 font-bold text-lapis">
                        {p?.name ?? s.slug}
                        {!p?.rates && <span className="block text-xs font-medium text-ink-muted">{t("approxRate")}</span>}
                      </span>
                      <span className="text-sm text-ink-muted">{t("nights")}</span>
                      <Stepper value={s.nights} min={1} max={10} onChange={(v) => setNights(i, v)} label={`${t("nights")}: ${p?.name ?? s.slug}`} />
                      <span className="flex gap-1">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("moveUp", { place: p?.name ?? s.slug })} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-cobalt disabled:opacity-30">
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === route.length - 1} aria-label={t("moveDown", { place: p?.name ?? s.slug })} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-cobalt disabled:opacity-30">
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </button>
                        <button type="button" onClick={() => toggle(s.slug)} aria-label={t("remove", { place: p?.name ?? s.slug })} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-danger/10 hover:text-danger">
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 font-semibold text-lapis">
                {t("daysNights", { days: totalDays, nights: totalNights })}
                <span className="font-normal text-ink-muted"> · {t("estimateShort", { range: range(perAdult) })}</span>
              </p>
            </>
          )}
        </section>

        {/* 3. Travellers and style */}
        <section className={card} aria-labelledby="b-step3">
          <div id="b-step3">{stepTitle(3, t("step3"))}</div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("startDate")}
              <input
                type="date"
                min={todayInTashkent(new Date(Date.now() + 86400_000))}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 rounded-xl border border-field bg-white px-3 font-normal text-ink focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30"
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-semibold">
              {tc("adults")}
              <Stepper value={adults} min={1} max={20} onChange={setAdults} label={tc("adults")} />
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-semibold">
              {tc("children")}
              <Stepper value={children} min={0} max={10} onChange={setChildren} label={tc("children")} />
            </div>
          </div>
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">{t("level")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCOMMODATION_LEVELS.map((l) => (
                <label key={l} className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-field bg-white px-3 py-2 has-[:checked]:border-cobalt has-[:checked]:bg-sky has-[:checked]:ring-2 has-[:checked]:ring-cobalt/30">
                  <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} className="sr-only" />
                  <span className="font-bold text-lapis">{ts(`levels.${l}`)}</span>
                  <span className="text-xs text-ink-muted">{t(`levelHint.${l}` as never)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">{ts("interests")}</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests((xs) => (on ? xs.filter((x) => x !== i) : [...xs, i]))}
                    className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition ${on ? "bg-lapis text-white" : "bg-sky text-lapis hover:bg-cobalt/15"}`}
                  >
                    {ts(`interestOptions.${i}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* 4. Experiences */}
        <section className={card} aria-labelledby="b-step4">
          <div id="b-step4">{stepTitle(4, t("step4"))}</div>
          {availableExtras.length === 0 ? (
            <p className="mt-3 text-ink-muted">{route.length ? t("step4Empty") : t("step4Hint")}</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {availableExtras.map((e) => {
                const on = extras.includes(e.slug);
                return (
                  <li key={e.slug}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-field bg-white p-3 has-[:checked]:border-cobalt has-[:checked]:bg-sky">
                      <input type="checkbox" checked={on} onChange={() => setExtras((xs) => (on ? xs.filter((x) => x !== e.slug) : [...xs, e.slug]))} className="size-4 accent-[var(--color-cobalt)]" />
                      <span className="min-w-0 flex-1 text-sm font-semibold text-lapis">{e.title}</span>
                      <span className="shrink-0 text-sm text-ink-muted">{money(e.priceUsd)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <label className="mt-6 flex flex-col gap-1.5 text-sm font-semibold">
            {t("wishes")}
            <textarea
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              maxLength={1500}
              rows={3}
              placeholder={t("wishesPlaceholder")}
              className="rounded-xl border border-field bg-white p-3 font-normal text-ink focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30"
            />
          </label>
        </section>

        <div className="lg:hidden">{estimate}</div>

        {/* 5. Send */}
        <section id="send" className={`${card} scroll-mt-24`} aria-labelledby="b-step5">
          <div id="b-step5">{stepTitle(5, t("step5"))}</div>
          <p className="mt-2 text-ink-muted">{t("sendText")}</p>
          <div className="mt-5">
            {ready ? (
              <ServiceRequestForm kind="tailor-made" destinations={[]} preset={preset} hideDetails title={t("contactTitle")} submitLabel={t("sendCta")} />
            ) : (
              <p role="status" className="rounded-2xl bg-sky/60 p-4 text-ink/80">{t("needRoute")}</p>
            )}
          </div>
        </section>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-24">{estimate}</div>
      </aside>
    </div>
  );
}
