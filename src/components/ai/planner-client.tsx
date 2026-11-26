"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/db/types";
import { openAssistant } from "./assistant-widget";
import { PLANNER_STRINGS } from "./planner-strings";

type Plan = {
  title: string;
  summary: string;
  days: { day: number; place: string; title: string; plan: string; transport: string | null; tourSlug: string | null }[];
  destinations: string[];
  suggestedTours: { slug: string; title: string; why: string; url?: string }[];
  budget: { low: number; high: number; currency: "USD"; note: string };
  accommodation: string;
  transport: string;
  bestSeason: string;
  food: string[];
  tips: string[];
  generatedBy: "ai" | "catalogue";
};

const STYLE_KEYS = ["history", "food2", "nature", "crafts", "family", "adventure"] as const;

export function PlannerClient({ locale, initialId }: { locale: Locale; initialId?: string }) {
  const t = PLANNER_STRINGS[locale];
  const [request, setRequest] = useState("");
  const [days, setDays] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [styles, setStyles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!initialId) return;
    fetch(`/api/ai/plans/${encodeURIComponent(initialId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: { id: string; plan: Plan; request: string } }>) : null))
      .then((j: { data?: { id: string; plan: Plan; request: string } } | null) => {
        if (j?.data) {
          setPlan(j.data.plan);
          setPlanId(j.data.id);
          setRequest(j.data.request);
        }
      })
      .catch(() => {});
  }, [initialId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (request.trim().length < 5 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: request.trim(),
          locale,
          ...(days ? { days: Number(days) } : {}),
          ...(budget ? { budgetUsd: Number(budget) } : {}),
          ...(styles.length ? { styles: styles.map((s) => PLANNER_STRINGS.en[s as keyof typeof PLANNER_STRINGS.en]) } : {}),
        }),
      });
      if (res.status === 429) throw new Error(t.limited);
      if (!res.ok) throw new Error(t.error);
      const { data } = (await res.json()) as { data: { id: string; plan: Plan } };
      setPlan(data.plan);
      setPlanId(data.id);
      const url = new URL(window.location.href);
      url.searchParams.set("plan", data.id);
      window.history.replaceState(null, "", url.toString());
      setTimeout(() => document.getElementById("plan-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError((err as Error).message || t.error);
    } finally {
      setBusy(false);
    }
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const firstTour = plan?.suggestedTours.find((s) => s.url) ?? null;
  const bookHref = firstTour
    ? `/${locale}/book/${firstTour.slug}?utm_source=planner${planId ? `&utm_campaign=${planId}` : ""}`
    : `/${locale}/contact`;

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <form onSubmit={submit} className="space-y-5 border border-lapis-deep/10 bg-white p-6 lg:col-span-4 lg:self-start print:hidden">
        <label className="block">
          <span className="text-sm font-bold">{t.request}</span>
          <textarea
            required
            minLength={5}
            maxLength={1500}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t.requestPh}
            rows={5}
            className="mt-2 w-full rounded-sm border border-field bg-white p-3 text-base focus:border-lapis-deep focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-bold">{t.days}</span>
            <select value={days} onChange={(e) => setDays(e.target.value)} className="mt-2 h-11 w-full rounded-sm border border-field bg-white px-2">
              <option value="">{t.any}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold">{t.budget}</span>
            <select value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-2 h-11 w-full rounded-sm border border-field bg-white px-2">
              <option value="">{t.any}</option>
              {[300, 500, 700, 1000, 1500, 2500].map((b) => (
                <option key={b} value={b}>≤ ${b}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">{t.styles}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLE_KEYS.map((k) => {
              const on = styles.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStyles((s) => (on ? s.filter((x) => x !== k) : [...s, k]))}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-lapis-deep bg-lapis-deep text-ivory" : "border-lapis-deep/25 bg-white hover:border-lapis-deep"}`}
                >
                  {t[k]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-[2px] bg-terracotta px-5 font-bold text-white hover:bg-terracotta-deep disabled:opacity-60">
          {busy ? t.working : t.submit}
        </button>
        {error && <p role="alert" className="text-sm font-semibold text-terracotta-deep">{error}</p>}
        <p className="text-xs text-ink-muted">{t.disclaimer}</p>
      </form>

      <div id="plan-result" className="lg:col-span-8" aria-live="polite">
        {busy && !plan && (
          <div className="space-y-3" aria-label={t.working}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse bg-sand-soft" />
            ))}
          </div>
        )}
        {plan && (
          <article className="space-y-8">
            <header>
              <p className="eyebrow text-terracotta">{plan.days.length} {t.day.toLowerCase()} · {plan.destinations.join(" · ")}</p>
              <h2 className="mt-2 text-4xl text-lapis-deep">{plan.title}</h2>
              {plan.summary && <p className="mt-3 text-lg text-ink-muted">{plan.summary}</p>}
              {plan.generatedBy === "catalogue" && <p className="mt-3 border-l-2 border-terracotta pl-3 text-sm">{t.catalogue}</p>}
            </header>

            <ol className="relative space-y-4 border-l border-dashed border-lapis-deep/40 pl-6">
              {plan.days.map((d) => {
                const tour = d.tourSlug ? plan.suggestedTours.find((s) => s.slug === d.tourSlug && s.url) : null;
                return (
                  <li key={d.day} className="relative bg-white p-5">
                    <span className="absolute -left-[33px] top-5 grid size-4 place-items-center rounded-full border-2 border-lapis-deep bg-ivory" aria-hidden />
                    <p className="eyebrow text-turquoise-ink">{t.day} {d.day} · {d.place}</p>
                    <h3 className="mt-1 text-2xl text-lapis-deep">{d.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-ink">{d.plan}</p>
                    {d.transport && <p className="mt-2 text-sm text-ink-muted">→ {d.transport}</p>}
                    {tour && (
                      <a href={tour.url} className="mt-3 inline-block text-sm font-bold text-lapis underline underline-offset-2">{tour.title}</a>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="bg-lapis-deep p-5 text-ivory">
                <p className="eyebrow text-saffron">{t.budgetTitle}</p>
                <p className="mt-2 font-display text-4xl">${plan.budget.low.toLocaleString()}–{plan.budget.high.toLocaleString()}</p>
                <p className="mt-1 text-sm text-sand">{t.perPerson}</p>
                {plan.budget.note && <p className="mt-2 text-sm text-sand">{plan.budget.note}</p>}
              </section>
              {!!plan.suggestedTours.length && (
                <section className="bg-white p-5">
                  <p className="eyebrow text-terracotta">{t.suggested}</p>
                  <ul className="mt-2 space-y-2">
                    {plan.suggestedTours.filter((s) => s.url).map((s) => (
                      <li key={s.slug}>
                        <a href={s.url} className="font-display text-lg text-lapis-deep underline-offset-2 hover:underline">{s.title}</a>
                        {s.why && <p className="text-sm text-ink-muted">{s.why}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <dl className="grid gap-4 md:grid-cols-3">
              {[
                [t.stay, plan.accommodation],
                [t.transport, plan.transport],
                [t.season, plan.bestSeason],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="border-t-2 border-lapis-deep pt-3">
                  <dt className="eyebrow text-ink-muted">{k}</dt>
                  <dd className="mt-1 text-sm">{v}</dd>
                </div>
              ))}
            </dl>

            {(!!plan.food.length || !!plan.tips.length) && (
              <div className="grid gap-4 md:grid-cols-2">
                {!!plan.food.length && (
                  <section>
                    <p className="eyebrow text-terracotta">{t.food}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.food.map((f) => <li key={f}>{f}</li>)}</ul>
                  </section>
                )}
                {!!plan.tips.length && (
                  <section>
                    <p className="eyebrow text-terracotta">{t.tips}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.tips.map((f) => <li key={f}>{f}</li>)}</ul>
                  </section>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 print:hidden">
              <a href={bookHref} className="inline-flex min-h-12 items-center rounded-[2px] bg-terracotta px-5 font-bold text-white hover:bg-terracotta-deep">{t.book}</a>
              <button type="button" onClick={share} className="inline-flex min-h-12 items-center rounded-[2px] border border-lapis-deep px-5 font-bold hover:bg-lapis-deep hover:text-ivory">{copied ? t.copied : t.share}</button>
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center rounded-[2px] border border-lapis-deep px-5 font-bold hover:bg-lapis-deep hover:text-ivory">{t.print}</button>
              <button type="button" onClick={() => openAssistant()} className="inline-flex min-h-12 items-center rounded-[2px] border border-lapis-deep px-5 font-bold hover:bg-lapis-deep hover:text-ivory">{t.ask}</button>
            </div>
            <p className="text-xs text-ink-muted">{t.disclaimer}</p>
          </article>
        )}
      </div>
    </div>
  );
}
