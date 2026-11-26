"use client";

import { Check, CheckCircle2, Circle, Copy, Link2, Loader2, Send, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import type { Locale } from "@/db/types";
import { apiFetch } from "@/lib/client/api";
import { orderedItems, tripSignature, type Budget } from "@/lib/trip-helpers";
import type { TripState } from "@/lib/trip-store";
import { todayInTashkent } from "@/validators/common";

const SAVED_KEY = "nt.tripBuilder.saved.v1";

type Saved = { id: string; sig: string };
function readSaved(): Saved | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "null") as Saved | null;
    return v && typeof v.id === "string" && typeof v.sig === "string" ? v : null;
  } catch {
    return null;
  }
}
function writeSaved(v: Saved) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the link still works for this visit */
  }
}

/** Saving the trip under a share link, and sending it to a travel manager (custom tour request with the trip id). */
export function useTripSaving(trip: TripState, includeMeals: boolean, update: (fn: (t: TripState) => TripState) => void) {
  const locale = useLocale() as Locale;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const te = useTranslations("tripBuilder.share");
  useEffect(() => setSaved(readSaved()), []);
  const sig = tripSignature(trip);
  const upToDate = !!saved && saved.sig === sig;

  const save = async (): Promise<string | null> => {
    if (saved && saved.sig === sig) return saved.id;
    setBusy(true);
    setError(null);
    const r = await apiFetch<{ id: string }>("/api/trips", { method: "POST", json: { trip: { ...trip, savedId: undefined }, locale, includeMeals } });
    setBusy(false);
    if (!r.ok) {
      setError(r.status === 429 ? te("rateLimited") : r.error.code === "network_error" ? te("network") : r.error.code === "validation_failed" ? te("invalid") : te("error"));
      return null;
    }
    const next = { id: r.data.id, sig };
    setSaved(next);
    writeSaved(next);
    update((s) => ({ ...s, savedId: r.data.id }));
    return r.data.id;
  };
  /** The trip now in the builder is exactly snapshot `id` (it was just opened from a share link). */
  const markSaved = (t: TripState, id: string) => {
    const next = { id, sig: tripSignature(t) };
    setSaved(next);
    writeSaved(next);
  };
  return { saved, upToDate, busy, error, save, markSaved, locale };
}

export function shareUrl(locale: string, id: string): string {
  return `${window.location.origin}/${locale}/trip-builder?trip=${id}`;
}

export function BuilderShare({ saving }: { saving: ReturnType<typeof useTripSaving> }) {
  const t = useTranslations("tripBuilder.share");
  const { saved, upToDate, busy, error, save, locale } = saving;
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const url = saved ? shareUrl(locale, saved.id) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link stays selectable in the field */
    }
  };
  const btn = "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition";

  return (
    <section aria-labelledby="tb-share" className="card p-5 sm:p-6">
      <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
      <h2 id="tb-share" className="mt-1.5 text-2xl text-lapis">
        {t("title")}
      </h2>
      <p className="mt-1 text-ink/75">{t("text")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy || upToDate} className={`${btn} bg-lapis text-white hover:bg-cobalt disabled:opacity-60`}>
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : upToDate ? <Check aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
          {upToDate ? t("saved") : saved ? t("saveAgain") : t("save")}
        </button>
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        {saved && (
          <div className="mt-4 space-y-3">
            {!upToDate && <p className="rounded-xl bg-saffron-soft px-3 py-2 text-sm text-ink">{t("changed")}</p>}
            <label className="block text-sm font-semibold text-ink">
              {t("link")}
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-field bg-sand-soft px-3 font-mono text-sm text-ink"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className={`${btn} bg-sky text-lapis hover:bg-lapis hover:text-white`}>
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied ? t("copied") : t("copy")}
              </button>
              {canShare && (
                <button type="button" onClick={() => navigator.share({ title: t("shareTitle"), url }).catch(() => undefined)} className={`${btn} bg-sky text-lapis hover:bg-lapis hover:text-white`}>
                  <Share2 aria-hidden="true" className="size-4" /> {t("shareNative")}
                </button>
              )}
              <a href={`https://wa.me/?text=${encodeURIComponent(`${t("shareTitle")} ${url}`)}`} target="_blank" rel="noopener" className={`${btn} bg-sky text-lapis hover:bg-lapis hover:text-white`}>
                WhatsApp
              </a>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t("shareTitle"))}`} target="_blank" rel="noopener" className={`${btn} bg-sky text-lapis hover:bg-lapis hover:text-white`}>
                <Send aria-hidden="true" className="size-4" /> Telegram
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function BuilderInquiry({
  trip,
  budget,
  money,
  saving,
  destinationName,
}: {
  trip: TripState;
  budget: Budget;
  money: (usd: number) => string;
  saving: ReturnType<typeof useTripSaving>;
  destinationName: (slug: string) => string;
}) {
  const t = useTranslations("tripBuilder.inquiry");
  const [open, setOpen] = useState(false);
  const { saved, upToDate, busy, error, save, locale } = saving;
  const today = todayInTashkent();
  const checks = [
    { key: "destinations", ok: trip.destinations.length > 0 && trip.destinations.length <= 9 },
    { key: "dates", ok: !!trip.startDate && !!trip.endDate && trip.startDate >= today && trip.endDate >= trip.startDate },
    { key: "items", ok: trip.items.length > 0 },
  ] as const;
  const ready = checks[0].ok && checks[1].ok;

  // Keep the request pointing at the latest version of the trip while the form is open.
  useEffect(() => {
    if (!open || upToDate || busy || !ready) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, upToDate, busy, ready, trip]);

  const preset = useMemo(() => {
    if (!saved) return null;
    const lines: string[] = [];
    if (trip.title.trim()) lines.push(trip.title.trim());
    const items = orderedItems(trip.items);
    const days = [...new Set(items.map((i) => i.day ?? 0))];
    for (const d of days) {
      const list = items.filter((i) => (i.day ?? 0) === d).map((i) => i.title);
      lines.push(`${d ? t("notesDay", { day: d }) : t("notesUnscheduled")}: ${list.join("; ")}`);
    }
    lines.push(t("notesEstimate", { total: money(budget.totalUsd), perPerson: money(budget.perPersonUsd) }));
    lines.push(`${t("notesLink")}: ${shareUrl(locale, saved.id)}`);
    let notes = lines.join("\n");
    if (notes.length > 3000) notes = notes.slice(0, 2990) + "…";
    return {
      startDate: trip.startDate ?? "",
      endDate: trip.endDate ?? "",
      adults: trip.adults,
      children: trip.children,
      destinationSlugs: trip.destinations.slice(0, 9),
      interests: [],
      accommodationLevel: "comfort",
      budgetPerPersonUsd: budget.perPersonUsd > 0 ? Math.min(100_000, budget.perPersonUsd) : undefined,
      notes,
      tripId: saved.id,
    };
  }, [saved, trip, budget, money, locale, t]);

  return (
    <section id="tb-request" aria-labelledby="tb-inquiry" className="card scroll-mt-24 p-5 sm:p-6">
      <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
      <h2 id="tb-inquiry" className="mt-1.5 text-2xl text-lapis">
        {t("title")}
      </h2>
      <p className="mt-1 text-ink/75">{t("text")}</p>
      <ul className="mt-4 space-y-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {c.ok ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />}
            <span className={c.ok ? "text-ink" : "text-ink-muted"}>
              {t(`check.${c.key}`)}
              <span className="sr-only">: {c.ok ? t("done") : t("todo")}</span>
              {c.key === "destinations" && c.ok && <span className="text-ink-muted"> · {trip.destinations.map(destinationName).join(", ")}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!open || !preset ? (
        <>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={async () => {
              if (await save()) setOpen(true);
            }}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep transition hover:bg-saffron-soft disabled:opacity-55 sm:w-auto"
          >
            {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t("cta")}
          </button>
          {!ready && <p className="mt-2 text-sm text-ink-muted">{t("needMore")}</p>}
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="mt-5">
          <ServiceRequestForm kind="tailor-made" destinations={[]} preset={preset} hideDetails compact title={t("contactTitle")} submitLabel={t("submit")} />
        </div>
      )}
    </section>
  );
}
