"use client";

import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import type { Locale } from "@/db/types";
import { todayInTashkent } from "@/validators/common";
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

type Day = Plan["days"][number];
export type PlannerPlace = { slug: string; names: string[] };

export function PlannerClient({ locale, initialId, places = [] }: { locale: Locale; initialId?: string; places?: PlannerPlace[] }) {
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
  const [itinerary, setItinerary] = useState<Day[]>([]);
  const [removed, setRemoved] = useState<Day[]>([]);
  const [startDate, setStartDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [changes, setChanges] = useState("");

  useEffect(() => {
    setItinerary(plan?.days ?? []);
    setRemoved([]);
  }, [plan]);

  const move = (i: number, d: -1 | 1) =>
    setItinerary((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const n = [...list];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  const removeDay = (i: number) => {
    setRemoved((r) => [...r, itinerary[i]!]);
    setItinerary((list) => list.filter((_, k) => k !== i));
  };
  const restore = (d: Day) => {
    setRemoved((r) => r.filter((x) => x !== d));
    setItinerary((list) => [...list, d].sort((a, b) => a.day - b.day));
  };

  /** Destination slugs mentioned by the plan (matched on names in any language). */
  const slugs = useMemo(() => {
    const text = [...(plan?.destinations ?? []), ...itinerary.map((d) => d.place)].join(" | ").toLowerCase();
    return places.filter((p) => p.names.some((n) => n && text.includes(n.toLowerCase()))).map((p) => p.slug).slice(0, 9);
  }, [plan, itinerary, places]);

  const preset = useMemo(() => {
    if (!plan || !startDate || itinerary.length === 0) return null;
    const end = new Date(`${startDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + Math.max(0, itinerary.length - 1));
    const lines = itinerary.map((d, i) => `${t.day} ${i + 1}: ${d.place} — ${d.title}`);
    const notes = [
      `${plan.title}${planId ? ` (${planId})` : ""}`,
      ...lines,
      removed.length ? `${t.removed}: ${removed.map((d) => `${d.place} — ${d.title}`).join("; ")}` : "",
      changes.trim() ? `${t.changes} ${changes.trim()}` : "",
    ].filter(Boolean);
    return {
      startDate,
      endDate: end.toISOString().slice(0, 10),
      adults,
      children: kids,
      destinationSlugs: slugs.length ? slugs : places.slice(0, 1).map((p) => p.slug),
      interests: [],
      accommodationLevel: "comfort",
      budgetPerPersonUsd: Math.round((plan.budget.low + plan.budget.high) / 2) || undefined,
      notes: notes.join("\n").slice(0, 3000),
    };
  }, [plan, planId, itinerary, removed, changes, startDate, adults, kids, slugs, places, t]);

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
      <form onSubmit={submit} className="space-y-5 rounded-[1.5rem] bg-white p-6 shadow-card lg:col-span-4 lg:self-start print:hidden">
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
        <div className="grid grid-cols-2 items-end gap-3">
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
        <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-terracotta px-5 font-bold text-white hover:bg-terracotta-deep disabled:opacity-60">
          {busy ? t.working : t.submit}
        </button>
        {error && <p role="alert" className="text-sm font-semibold text-terracotta-deep">{error}</p>}
        <p className="text-xs text-ink-muted">{t.disclaimer}</p>
      </form>

      <div id="plan-result" className="lg:col-span-8" aria-live="polite">
        {!busy && !plan && (
          <div className="bg-ai-soft rounded-[1.5rem] p-6 shadow-card sm:p-8">
            <h2 className="text-2xl text-lapis">{t.emptyTitle}</h2>
            <p className="mt-2 text-ink/75">{t.emptyText}</p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {t.steps.map((step, i) => (
                <li key={step} className="rounded-2xl bg-white/80 p-4">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-lapis text-sm font-extrabold text-white">{i + 1}</span>
                  <p className="mt-2 text-sm font-semibold text-lapis">{step}</p>
                </li>
              ))}
            </ol>
            <ul className="mt-6 flex flex-col gap-2">
              {t.examples.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    onClick={() => setRequest(ex)}
                    className="inline-flex min-h-11 w-full items-center gap-2 rounded-2xl bg-white px-4 py-2 text-left text-sm font-semibold text-lapis shadow-sm transition hover:bg-sky"
                  >
                    <Sparkles aria-hidden="true" className="size-4 shrink-0 text-cobalt" /> {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {busy && !plan && (
          <div className="space-y-3" role="status" aria-label={t.working}>
            <p className="text-sm font-semibold text-cobalt">{t.working}</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-sky" />
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

            <ol className="relative space-y-4 border-l border-dashed border-cobalt/40 pl-6">
              {itinerary.map((d, i) => {
                const tour = d.tourSlug ? plan.suggestedTours.find((s) => s.slug === d.tourSlug && s.url) : null;
                return (
                  <li key={`${d.day}-${d.title}`} className="relative rounded-2xl bg-white p-5 shadow-card">
                    <span className="absolute -left-[33px] top-5 grid size-4 place-items-center rounded-full border-2 border-cobalt bg-white" aria-hidden />
                    <div className="float-right flex gap-1 print:hidden">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t.moveUp}: ${t.day} ${i + 1}`} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-cobalt disabled:opacity-30"><ArrowUp aria-hidden="true" className="size-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === itinerary.length - 1} aria-label={`${t.moveDown}: ${t.day} ${i + 1}`} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-cobalt disabled:opacity-30"><ArrowDown aria-hidden="true" className="size-4" /></button>
                      <button type="button" onClick={() => removeDay(i)} disabled={itinerary.length === 1} aria-label={`${t.removeDay}: ${t.day} ${i + 1}`} className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"><Trash2 aria-hidden="true" className="size-4" /></button>
                    </div>
                    <p className="eyebrow text-cobalt">{t.day} {i + 1} · {d.place}</p>
                    <h3 className="mt-1 text-xl text-lapis">{d.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-ink">{d.plan}</p>
                    {d.transport && <p className="mt-2 text-sm text-ink-muted">→ {d.transport}</p>}
                    {tour && (
                      <a href={tour.url} className="mt-3 inline-block text-sm font-bold text-lapis underline underline-offset-2">{tour.title}</a>
                    )}
                  </li>
                );
              })}
            </ol>

            {removed.length > 0 && (
              <div className="rounded-2xl bg-sky/60 p-4 text-sm print:hidden">
                <p className="font-semibold text-lapis">{t.removed}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {removed.map((d) => (
                    <li key={`${d.day}-${d.title}`}>
                      <button type="button" onClick={() => restore(d)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 font-semibold text-cobalt hover:bg-cobalt hover:text-white">
                        <RotateCcw aria-hidden="true" className="size-3.5" /> {t.restore}: {d.place}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl bg-lapis p-5 text-white">
                <p className="eyebrow text-saffron">{t.budgetTitle}</p>
                <p className="mt-2 font-display text-4xl">${plan.budget.low.toLocaleString()}–{plan.budget.high.toLocaleString()}</p>
                <p className="mt-1 text-sm text-white/75">{t.perPerson}</p>
                {plan.budget.note && <p className="mt-2 text-sm text-white/75">{plan.budget.note}</p>}
              </section>
              {!!plan.suggestedTours.length && (
                <section className="rounded-2xl bg-white p-5 shadow-card">
                  <p className="eyebrow text-cobalt">{t.suggested}</p>
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
              <a href="#send-plan" className="inline-flex min-h-12 items-center rounded-full bg-saffron px-5 font-bold text-lapis-deep hover:bg-[#e6b55a]">{t.sendCta}</a>
              {firstTour && <a href={bookHref} className="inline-flex min-h-12 items-center rounded-full border border-lapis/30 px-5 font-bold text-lapis hover:bg-lapis hover:text-white">{t.book}</a>}
              <button type="button" onClick={share} className="inline-flex min-h-12 items-center rounded-full border border-lapis/30 px-5 font-bold text-lapis hover:bg-lapis hover:text-white">{copied ? t.copied : t.share}</button>
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center rounded-full border border-lapis/30 px-5 font-bold text-lapis hover:bg-lapis hover:text-white">{t.print}</button>
              <button type="button" onClick={() => openAssistant()} className="inline-flex min-h-12 items-center rounded-full border border-lapis/30 px-5 font-bold text-lapis hover:bg-lapis hover:text-white">{t.ask}</button>
            </div>
            <p className="text-xs text-ink-muted">{t.disclaimer}</p>

            <section id="send-plan" className="scroll-mt-24 rounded-[1.5rem] bg-white p-6 shadow-card print:hidden" aria-labelledby="send-plan-title">
              <h2 id="send-plan-title" className="text-2xl text-lapis">{t.sendTitle}</h2>
              <p className="mt-2 text-ink-muted">{t.sendText}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {t.startDate}
                  <input type="date" min={todayInTashkent(new Date(Date.now() + 86400_000))} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl border border-field bg-white px-3 font-normal focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30" />
                </label>
                {([[t.adults, adults, setAdults, 1, 20], [t.children, kids, setKids, 0, 10]] as const).map(([label, value, set, min, max]) => (
                  <div key={label} className="flex flex-col gap-1.5 text-sm font-semibold">
                    {label}
                    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
                      <button type="button" onClick={() => set(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} −`} className="inline-flex size-10 items-center justify-center rounded-full bg-sky text-cobalt disabled:opacity-40"><Minus aria-hidden="true" className="size-4" /></button>
                      <span className="min-w-6 text-center text-lg font-extrabold text-lapis">{value}</span>
                      <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} +`} className="inline-flex size-10 items-center justify-center rounded-full bg-sky text-cobalt disabled:opacity-40"><Plus aria-hidden="true" className="size-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="mt-5 flex flex-col gap-1.5 text-sm font-semibold">
                {t.changes}
                <textarea value={changes} onChange={(e) => setChanges(e.target.value)} rows={3} maxLength={1500} placeholder={t.changesPh} className="rounded-xl border border-field bg-white p-3 font-normal focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30" />
              </label>
              <div className="mt-6">
                {preset ? (
                  <ServiceRequestForm kind="tailor-made" destinations={[]} preset={preset} hideDetails title={t.contactTitle} submitLabel={t.sendCta} />
                ) : (
                  <p role="status" className="rounded-2xl bg-sky/60 p-4 text-ink/80">{t.needDate}</p>
                )}
              </div>
            </section>
          </article>
        )}
      </div>
    </div>
  );
}
