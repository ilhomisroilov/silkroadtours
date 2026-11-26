"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import {
  AUDIENCES,
  BOOKING_TYPES,
  CURRENCIES,
  DEPARTURE_STATUSES,
  DIFFICULTIES,
  MEALS,
  TOUR_BADGES,
  TOUR_CATEGORIES,
  type AccommodationItem,
  type BookingType,
  type Currency,
  type DepartureStatus,
  type ExchangeRates,
  type LocalizedText,
  type Meal,
  type MediaItem,
  type RoutePoint,
  type TransportItem,
} from "@/db/types";
import { imageExists } from "@/lib/images";
import { cn } from "@/lib/cn";
import { CURRENCY_EXPONENT, formatMoney, tierPriceIn } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { useAdminApi } from "./booking-actions";
import { emptyLocalized, LocalizedFields, LocalizedLines } from "./localized";

const PointPicker = dynamic(() => import("./point-picker"), { ssr: false });

export interface EditorTour {
  id?: number;
  slug: string;
  audience: "inbound" | "domestic";
  category: (typeof TOUR_CATEGORIES)[number];
  primaryDestinationId: number;
  destinationIds: number[];
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  durationDays: number;
  durationNights: number;
  difficulty: (typeof DIFFICULTIES)[number];
  minGroup: number;
  maxGroup: number;
  baseCurrency: Currency;
  childPricePercent: number;
  compareAtPriceMinor: number | null;
  badges: (typeof TOUR_BADGES)[number][];
  included: LocalizedText[];
  excluded: LocalizedText[];
  accommodation: AccommodationItem[];
  transport: TransportItem[];
  route: RoutePoint[];
  guideLanguages: string[];
  seasonMonths: number[];
  heroImage: string;
  gallery: MediaItem[];
  seoTitle: LocalizedText | null;
  seoDescription: LocalizedText | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
}

export interface EditorDay {
  dayNumber: number;
  title: LocalizedText;
  description: LocalizedText;
  meals: Meal[];
  overnight: LocalizedText | null;
  distanceKm: number | null;
  walkingHours: number | null;
}

export interface EditorTier {
  bookingType: BookingType;
  minPax: number;
  maxPax: number;
  priceUsd: number | null;
  priceUzs: number | null;
  priceEur: number | null;
}

export interface EditorDeparture {
  id: number;
  startDate: string;
  endDate: string;
  seatsTotal: number;
  seatsBooked: number;
  status: DepartureStatus;
  priceModifierPercent: number;
}

const field = "block min-h-11 w-full rounded-sm border border-field bg-white px-3";
const nonEmpty = (l: LocalizedText) => !!(l.en.trim() || l.uz.trim() || l.ru.trim());
const optionalLocalized = (l: LocalizedText | null) => (l && nonEmpty(l) ? { en: l.en.trim() || l.uz || l.ru, uz: l.uz, ru: l.ru } : null);

/** Shape the editor state into the exact body PUT /api/admin/tours/[id] expects. */
export function toUpsertBody(t: EditorTour) {
  return {
    slug: t.slug.trim(),
    audience: t.audience,
    category: t.category,
    primaryDestinationId: t.primaryDestinationId,
    destinationIds: t.destinationIds.filter((d) => d !== t.primaryDestinationId),
    title: t.title,
    summary: t.summary,
    description: t.description,
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    difficulty: t.difficulty,
    minGroup: t.minGroup,
    maxGroup: t.maxGroup,
    baseCurrency: t.baseCurrency,
    childPricePercent: t.childPricePercent,
    compareAtPriceMinor: t.compareAtPriceMinor,
    badges: t.badges,
    included: t.included.filter(nonEmpty),
    excluded: t.excluded.filter(nonEmpty),
    accommodation: t.accommodation,
    transport: t.transport,
    route: t.route,
    guideLanguages: t.guideLanguages,
    seasonMonths: t.seasonMonths,
    heroImage: t.heroImage.trim(),
    gallery: t.gallery,
    seoTitle: optionalLocalized(t.seoTitle),
    seoDescription: optionalLocalized(t.seoDescription),
    isFeatured: t.isFeatured,
    isPublished: t.isPublished,
    sortOrder: t.sortOrder,
  };
}

function Num({ label, value, onChange, min, max, step }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cn(field, "mt-1 font-normal")} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-sm border border-line bg-white p-5">
      <h3 className="font-sans text-lg font-bold text-lapis-deep">{title}</h3>
      {children}
    </section>
  );
}

export function TourEditor({
  initial,
  itinerary: initialDays,
  tiers: initialTiers,
  departures,
  destinations,
  rates,
}: {
  initial: EditorTour;
  itinerary: EditorDay[];
  tiers: EditorTier[];
  departures: EditorDeparture[];
  destinations: { id: number; name: string }[];
  rates: ExchangeRates;
}) {
  const t = useTranslations("admin");
  const tt = useTranslations("admin.tours");
  const tc = useTranslations("categories");
  const tb = useTranslations("badges");
  const td = useTranslations("difficulty");
  const tm = useTranslations("monthsShort");
  const tmeal = useTranslations("meals");
  const router = useRouter();
  const search = useSearchParams();
  const call = useAdminApi();
  const [tour, setTour] = useState<EditorTour>(initial);
  const [days, setDays] = useState<EditorDay[]>(initialDays);
  const [tiers, setTiers] = useState<EditorTier[]>(initialTiers);
  const [busy, setBusy] = useState(false);
  const isNew = !tour.id;
  const set = <K extends keyof EditorTour>(k: K, v: EditorTour[K]) => setTour((x) => ({ ...x, [k]: v }));

  const saveTour = async () => {
    setBusy(true);
    const body = toUpsertBody(tour);
    if (isNew) {
      const r = await call<{ id: number }>("/api/admin/tours", { method: "POST", json: body }, tt("createdNotice"));
      setBusy(false);
      if (r && typeof r === "object") router.push(`/admin/tours/${r.id}?tab=itinerary`);
      return;
    }
    await call(`/api/admin/tours/${tour.id}`, { method: "PUT", json: body }, t("common.saved"));
    setBusy(false);
  };

  const saveButton = (onClick: () => void, testId: string) => (
    <div className="sticky bottom-0 z-10 -mx-1 flex justify-end border-t border-line bg-sand-soft/90 px-1 py-3 backdrop-blur">
      <Button onClick={onClick} disabled={busy} data-testid={testId}>{busy ? t("common.saving") : t("common.save")}</Button>
    </div>
  );

  // ── Content ────────────────────────────────────────────────────────────
  const content = (
    <div className="space-y-6">
      <Section title={tt("tabs.content")}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-semibold">{tt("slug")}
            <input value={tour.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={cn(field, "mt-1 font-normal")} />
          </label>
          <label className="block text-sm font-semibold">{tt("audience")}
            <select value={tour.audience} onChange={(e) => set("audience", e.target.value as EditorTour["audience"])} className={cn(field, "mt-1 font-normal")}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{tt("category")}
            <select value={tour.category} onChange={(e) => set("category", e.target.value as EditorTour["category"])} className={cn(field, "mt-1 font-normal")}>
              {TOUR_CATEGORIES.map((c) => <option key={c} value={c}>{tc(c)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{tt("primaryDestination")}
            <select value={tour.primaryDestinationId} onChange={(e) => set("primaryDestinationId", Number(e.target.value))} className={cn(field, "mt-1 font-normal")}>
              {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-semibold">{tt("otherDestinations")}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {destinations.filter((d) => d.id !== tour.primaryDestinationId).map((d) => (
                <label key={d.id} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-field bg-white px-3 text-sm">
                  <input type="checkbox" checked={tour.destinationIds.includes(d.id)} onChange={(e) => set("destinationIds", e.target.checked ? [...tour.destinationIds, d.id] : tour.destinationIds.filter((x) => x !== d.id))} />
                  {d.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <LocalizedFields label={tt("titleField")} value={tour.title} onChange={(v) => set("title", v)} required />
        <LocalizedFields label={tt("summary")} value={tour.summary} onChange={(v) => set("summary", v)} multiline rows={3} required />
        <LocalizedFields label={tt("description")} value={tour.description} onChange={(v) => set("description", v)} multiline rows={8} required />
      </Section>
      <Section title={tt("difficulty")}>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Num label={tt("durationDays")} value={tour.durationDays} min={1} max={60} onChange={(v) => set("durationDays", v ?? 1)} />
          <Num label={tt("durationNights")} value={tour.durationNights} min={0} max={60} onChange={(v) => set("durationNights", v ?? 0)} />
          <Num label={tt("minGroup")} value={tour.minGroup} min={1} onChange={(v) => set("minGroup", v ?? 1)} />
          <Num label={tt("maxGroup")} value={tour.maxGroup} min={1} onChange={(v) => set("maxGroup", v ?? 1)} />
          <Num label={tt("childPercent")} value={tour.childPricePercent} min={0} max={100} onChange={(v) => set("childPricePercent", v ?? 0)} />
          <Num label={tt("sortOrder")} value={tour.sortOrder} onChange={(v) => set("sortOrder", v ?? 0)} />
          <label className="block text-sm font-semibold">{tt("difficulty")}
            <select value={tour.difficulty} onChange={(e) => set("difficulty", e.target.value as EditorTour["difficulty"])} className={cn(field, "mt-1 font-normal")}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{td(d)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{tt("baseCurrency")}
            <select value={tour.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value as Currency)} className={cn(field, "mt-1 font-normal")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Num
              label={tt("compareAt")}
              value={tour.compareAtPriceMinor == null ? null : tour.compareAtPriceMinor / 10 ** CURRENCY_EXPONENT[tour.baseCurrency]}
              min={0}
              onChange={(v) => set("compareAtPriceMinor", v == null ? null : Math.round(v * 10 ** CURRENCY_EXPONENT[tour.baseCurrency]))}
            />
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">{tt("badges")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {TOUR_BADGES.map((b) => (
              <label key={b} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-field bg-white px-3 text-sm">
                <input type="checkbox" checked={tour.badges.includes(b)} onChange={(e) => set("badges", e.target.checked ? [...tour.badges, b] : tour.badges.filter((x) => x !== b))} />
                {tb(b)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">{tt("seasonMonths")}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <label key={m} className="inline-flex min-h-11 min-w-14 items-center justify-center gap-1 rounded-sm border border-field bg-white px-2 text-sm has-[:checked]:border-lapis has-[:checked]:bg-lapis has-[:checked]:text-white">
                <input type="checkbox" className="sr-only" checked={tour.seasonMonths.includes(m)} onChange={(e) => set("seasonMonths", e.target.checked ? [...tour.seasonMonths, m].sort((a, b) => a - b) : tour.seasonMonths.filter((x) => x !== m))} />
                {tm(String(m) as never)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">{tt("guideLanguages")}
          <input value={tour.guideLanguages.join(", ")} onChange={(e) => set("guideLanguages", e.target.value.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length === 2))} className={cn(field, "mt-1 font-normal")} />
        </label>
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" checked={tour.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="size-5" data-testid="tour-published" />{tt("isPublished")}</label>
          <label className="inline-flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" checked={tour.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="size-5" />{tt("isFeatured")}</label>
        </div>
      </Section>
      <Section title={`${tt("included")} / ${tt("excluded")}`}>
        <LocalizedLines label={tt("included")} value={tour.included} onChange={(v) => set("included", v)} />
        <LocalizedLines label={tt("excluded")} value={tour.excluded} onChange={(v) => set("excluded", v)} />
      </Section>
      <Section title={tt("seo")}>
        <LocalizedFields label={tt("seoTitle")} value={tour.seoTitle} onChange={(v) => set("seoTitle", v)} />
        <LocalizedFields label={tt("seoDescription")} value={tour.seoDescription} onChange={(v) => set("seoDescription", v)} multiline rows={2} />
      </Section>
      {saveButton(saveTour, "tour-save")}
    </div>
  );

  // ── Itinerary ──────────────────────────────────────────────────────────
  const renumber = (list: EditorDay[]) => list.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  const itinerary = (
    <div className="space-y-4">
      {days.map((d, i) => (
        <Section key={i} title={tt("day", { day: d.dayNumber })}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setDays(renumber(days.map((x, j) => (j === i - 1 ? days[i]! : j === i ? days[i - 1]! : x))))}><ArrowUp aria-hidden="true" />{t("common.moveUp")}</Button>
            <Button size="sm" variant="ghost" disabled={i === days.length - 1} onClick={() => setDays(renumber(days.map((x, j) => (j === i + 1 ? days[i]! : j === i ? days[i + 1]! : x))))}><ArrowDown aria-hidden="true" />{t("common.moveDown")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDays(renumber(days.filter((_, j) => j !== i)))}><Trash2 aria-hidden="true" />{t("common.remove")}</Button>
          </div>
          <LocalizedFields label={tt("titleField")} value={d.title} onChange={(v) => setDays(days.map((x, j) => (j === i ? { ...x, title: v } : x)))} required />
          <LocalizedFields label={tt("description")} value={d.description} multiline onChange={(v) => setDays(days.map((x, j) => (j === i ? { ...x, description: v } : x)))} required />
          <LocalizedFields label={tt("overnight")} value={d.overnight} onChange={(v) => setDays(days.map((x, j) => (j === i ? { ...x, overnight: v } : x)))} />
          <div className="grid items-end gap-4 sm:grid-cols-3">
            <fieldset>
              <legend className="text-sm font-semibold">{tt("meals")}</legend>
              <div className="mt-1 flex gap-2">
                {MEALS.map((m) => (
                  <label key={m} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-field bg-white px-3 text-sm">
                    <input type="checkbox" checked={d.meals.includes(m)} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, meals: e.target.checked ? [...x.meals, m] : x.meals.filter((y) => y !== m) } : x)))} />
                    {tmeal(m)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Num label={tt("distanceKm")} value={d.distanceKm} min={0} onChange={(v) => setDays(days.map((x, j) => (j === i ? { ...x, distanceKm: v } : x)))} />
            <Num label={tt("walkingHours")} value={d.walkingHours} min={0} step={0.5} onChange={(v) => setDays(days.map((x, j) => (j === i ? { ...x, walkingHours: v } : x)))} />
          </div>
        </Section>
      ))}
      <Button variant="outline" onClick={() => setDays([...days, { dayNumber: days.length + 1, title: emptyLocalized(), description: emptyLocalized(), meals: [], overnight: null, distanceKm: null, walkingHours: null }])}>
        <Plus aria-hidden="true" /> {tt("addDay")}
      </Button>
      {saveButton(async () => {
        setBusy(true);
        await call(`/api/admin/tours/${tour.id}/itinerary`, {
          method: "PUT",
          json: days.map((d) => ({ ...d, overnight: optionalLocalized(d.overnight) })),
        }, t("common.saved"));
        setBusy(false);
      }, "itinerary-save")}
    </div>
  );

  // ── Pricing ────────────────────────────────────────────────────────────
  const priceCols: { key: "priceUsd" | "priceUzs" | "priceEur"; cur: Currency }[] = [
    { key: "priceUsd", cur: "USD" },
    { key: "priceUzs", cur: "UZS" },
    { key: "priceEur", cur: "EUR" },
  ];
  const preview = (tier: EditorTier, cur: Currency) => {
    try {
      return formatMoney(tierPriceIn(tier, cur, tour.baseCurrency, rates).amountMinor, cur, "en");
    } catch {
      return "—";
    }
  };
  const pricing = (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-sand-soft text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">{tt("tierType")}</th>
              <th className="px-3 py-2 text-left">{tt("tierMin")}</th>
              <th className="px-3 py-2 text-left">{tt("tierMax")}</th>
              {priceCols.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.cur}{c.cur === tour.baseCurrency ? " *" : ""}</th>)}
              <th className="px-3 py-2 text-left">{tt("preview")}</th>
              <th className="px-3 py-2"><span className="sr-only">{t("common.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-2">
                  <select aria-label={tt("tierType")} value={tier.bookingType} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, bookingType: e.target.value as BookingType } : x)))} className="min-h-11 rounded-sm border border-field px-2">
                    {BOOKING_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                {(["minPax", "maxPax"] as const).map((k) => (
                  <td key={k} className="px-3 py-2"><input aria-label={tt(k === "minPax" ? "tierMin" : "tierMax")} type="number" min={1} value={tier[k]} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)))} className="min-h-11 w-20 rounded-sm border border-field px-2" /></td>
                ))}
                {priceCols.map((c) => (
                  <td key={c.key} className="px-3 py-2">
                    <input
                      aria-label={c.cur}
                      type="number"
                      min={0}
                      step={c.cur === "UZS" ? 1000 : 1}
                      value={tier[c.key] == null ? "" : tier[c.key]! / 10 ** CURRENCY_EXPONENT[c.cur]}
                      placeholder={c.cur === tour.baseCurrency ? "" : preview(tier, c.cur)}
                      onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value === "" ? null : Math.round(Number(e.target.value) * 10 ** CURRENCY_EXPONENT[c.cur]) } : x)))}
                      className={cn("min-h-11 w-32 rounded-sm border px-2", c.cur === tour.baseCurrency ? "border-lapis" : "border-field")}
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted">{CURRENCIES.map((c) => preview(tier, c)).join(" · ")}</td>
                <td className="px-3 py-2"><button type="button" aria-label={t("common.remove")} onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-danger/10"><Trash2 aria-hidden="true" className="size-4 text-danger" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">{tt("previewNote")} USD 1 = {rates.rates.UZS.toLocaleString("en")} UZS = {rates.rates.EUR} EUR</p>
      <Button variant="outline" onClick={() => setTiers([...tiers, { bookingType: "private", minPax: (tiers.at(-1)?.maxPax ?? 0) + 1, maxPax: (tiers.at(-1)?.maxPax ?? 0) + 2, priceUsd: null, priceUzs: null, priceEur: null }])}>
        <Plus aria-hidden="true" /> {tt("addTier")}
      </Button>
      {saveButton(async () => {
        setBusy(true);
        await call(`/api/admin/tours/${tour.id}/pricing`, { method: "PUT", json: tiers }, t("common.saved"));
        setBusy(false);
      }, "pricing-save")}
    </div>
  );

  // ── Media ──────────────────────────────────────────────────────────────
  const galleryText = tour.gallery.map((g) => g.url).join("\n");
  const media = (
    <div className="space-y-4">
      <Section title={tt("heroImage")}>
        <p className="text-sm text-ink-muted">{tt("imageHint")}</p>
        <input value={tour.heroImage} onChange={(e) => set("heroImage", e.target.value)} className={field} aria-label={tt("heroImage")} />
        <ImagePreview src={tour.heroImage} missing={tt("imageMissing")} />
      </Section>
      <Section title={tt("gallery")}>
        <textarea
          aria-label={tt("gallery")}
          rows={6}
          value={galleryText}
          onChange={(e) => {
            const urls = e.target.value.split("\n").map((u) => u.trim()).filter(Boolean);
            const byUrl = new Map(tour.gallery.map((g) => [g.url, g]));
            set("gallery", urls.map((url) => byUrl.get(url) ?? { url, type: "image", alt: { ...tour.title } }));
          }}
          className="block w-full rounded-sm border border-field bg-white px-3 py-2 font-mono text-sm"
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tour.gallery.map((g) => <li key={g.url}><ImagePreview src={g.url} missing={tt("imageMissing")} /></li>)}
        </ul>
      </Section>
      {saveButton(saveTour, "media-save")}
    </div>
  );

  // ── Route ──────────────────────────────────────────────────────────────
  const route = (
    <div className="space-y-4">
      <Section title={tt("routePoints")}>
        <p className="text-sm text-ink-muted">{tt("pickOnMap")}</p>
        <div className="h-80 overflow-hidden rounded-sm">
          <PointPicker points={tour.route.map((p) => ({ lat: p.lat, lng: p.lng, label: p.label.en }))} onPick={(lat, lng) => set("route", [...tour.route, { lat, lng, label: emptyLocalized(), day: tour.route.length + 1 }])} />
        </div>
        <ol className="space-y-3">
          {tour.route.map((p, i) => (
            <li key={i} className="space-y-2 rounded-sm border border-line p-3">
              <div className="grid items-end gap-3 sm:grid-cols-4">
                <Num label={tt("lat")} value={p.lat} step={0.0001} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, lat: v ?? x.lat } : x)))} />
                <Num label={tt("lng")} value={p.lng} step={0.0001} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, lng: v ?? x.lng } : x)))} />
                <Num label={tt("dayLabel")} value={p.day ?? null} min={1} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, day: v ?? undefined } : x)))} />
                <Button variant="ghost" size="sm" onClick={() => set("route", tour.route.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" />{t("common.remove")}</Button>
              </div>
              <LocalizedFields label={tt("label")} value={p.label} onChange={(v) => set("route", tour.route.map((x, j) => (j === i ? { ...x, label: v } : x)))} required />
            </li>
          ))}
        </ol>
      </Section>
      {saveButton(saveTour, "route-save")}
    </div>
  );

  const tab = search.get("tab") ?? "content";
  return (
    <Tabs defaultValue={isNew ? "content" : tab}>
      <TabsList aria-label={tt("title")}>
        <TabsTrigger value="content">{tt("tabs.content")}</TabsTrigger>
        <TabsTrigger value="itinerary" disabled={isNew}>{tt("tabs.itinerary")}</TabsTrigger>
        <TabsTrigger value="pricing" disabled={isNew}>{tt("tabs.pricing")}</TabsTrigger>
        <TabsTrigger value="departures" disabled={isNew}>{tt("tabs.departures")}</TabsTrigger>
        <TabsTrigger value="media">{tt("tabs.media")}</TabsTrigger>
        <TabsTrigger value="route">{tt("tabs.route")}</TabsTrigger>
      </TabsList>
      <TabsContent value="content">{content}</TabsContent>
      <TabsContent value="itinerary">{itinerary}</TabsContent>
      <TabsContent value="pricing">{pricing}</TabsContent>
      <TabsContent value="departures">{tour.id ? <DeparturesTab tourId={tour.id} durationDays={tour.durationDays} departures={departures} /> : null}</TabsContent>
      <TabsContent value="media">{media}</TabsContent>
      <TabsContent value="route">{route}</TabsContent>
    </Tabs>
  );
}

function ImagePreview({ src, missing }: { src: string; missing: string }) {
  if (!src) return null;
  if (!imageExists(src)) return <p className="rounded-sm bg-saffron-soft/50 p-2 text-xs text-saffron-ink">{src} — {missing}</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="aspect-[4/3] w-full max-w-xs rounded-sm object-cover" loading="lazy" />;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(isoDate: string, n: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function DeparturesTab({ tourId, durationDays, departures }: { tourId: number; durationDays: number; departures: EditorDeparture[] }) {
  const t = useTranslations("admin");
  const tt = useTranslations("admin.tours");
  const call = useAdminApi();
  const [rows, setRows] = useState(departures);
  const [draft, setDraft] = useState({ startDate: "", seatsTotal: 12, status: "open" as DepartureStatus, priceModifierPercent: 0 });
  const dates = useMemo(() => new Map(rows.map((r) => [r.startDate, r])), [rows]);
  const upd = (id: number, patch: Partial<EditorDeparture>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const body = (r: EditorDeparture) => ({ startDate: r.startDate, endDate: r.endDate, seatsTotal: r.seatsTotal, status: r.status, priceModifierPercent: r.priceModifierPercent });
  return (
    <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
      <div className="space-y-4">
        <div className="rounded-sm border border-line bg-white p-3">
          <Calendar
            mode="single"
            numberOfMonths={1}
            selected={draft.startDate ? new Date(`${draft.startDate}T00:00:00`) : undefined}
            onSelect={(d) => d && setDraft({ ...draft, startDate: iso(d) })}
            modifiers={{ departure: (d) => dates.has(iso(d)) }}
            modifiersClassNames={{ departure: "[&>button]:bg-saffron-soft [&>button]:font-bold [&>button]:text-white" }}
          />
        </div>
        <form
          className="space-y-3 rounded-sm border border-line bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.startDate) return;
            const r = await call<{ id: number }>(`/api/admin/tours/${tourId}/departures`, {
              method: "POST",
              json: { ...draft, endDate: addDays(draft.startDate, Math.max(0, durationDays - 1)) },
            }, t("common.saved"));
            if (r && typeof r === "object") {
              setRows([...rows, { id: r.id, startDate: draft.startDate, endDate: addDays(draft.startDate, Math.max(0, durationDays - 1)), seatsTotal: draft.seatsTotal, seatsBooked: 0, status: draft.status, priceModifierPercent: draft.priceModifierPercent }].sort((a, b) => a.startDate.localeCompare(b.startDate)));
              setDraft({ ...draft, startDate: "" });
            }
          }}
        >
          <p className="font-bold text-lapis-deep">{tt("addDeparture")}</p>
          <label className="block text-sm font-semibold">{tt("startDate")}<input type="date" required value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={cn(field, "mt-1 font-normal")} /></label>
          <Num label={tt("seatsTotal")} value={draft.seatsTotal} min={1} onChange={(v) => setDraft({ ...draft, seatsTotal: v ?? 1 })} />
          <Num label={tt("modifier")} value={draft.priceModifierPercent} min={-90} max={300} onChange={(v) => setDraft({ ...draft, priceModifierPercent: v ?? 0 })} />
          <Button type="submit" variant="secondary"><Plus aria-hidden="true" />{tt("addDeparture")}</Button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-sand-soft text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">{tt("startDate")}</th>
              <th className="px-3 py-2 text-left">{tt("endDate")}</th>
              <th className="px-3 py-2 text-left">{tt("seatsTotal")}</th>
              <th className="px-3 py-2 text-left">{tt("seatsBooked")}</th>
              <th className="px-3 py-2 text-left">{tt("depStatus")}</th>
              <th className="px-3 py-2 text-left">{tt("modifier")}</th>
              <th className="px-3 py-2"><span className="sr-only">{t("common.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2"><input aria-label={tt("startDate")} type="date" value={r.startDate} onChange={(e) => upd(r.id, { startDate: e.target.value })} className="min-h-11 rounded-sm border border-field px-2" /></td>
                <td className="px-3 py-2"><input aria-label={tt("endDate")} type="date" value={r.endDate} onChange={(e) => upd(r.id, { endDate: e.target.value })} className="min-h-11 rounded-sm border border-field px-2" /></td>
                <td className="px-3 py-2"><input aria-label={tt("seatsTotal")} type="number" min={1} value={r.seatsTotal} onChange={(e) => upd(r.id, { seatsTotal: Number(e.target.value) })} className="min-h-11 w-20 rounded-sm border border-field px-2" /></td>
                <td className="px-3 py-2 tabular-nums">{r.seatsBooked}</td>
                <td className="px-3 py-2">
                  <select aria-label={tt("depStatus")} value={r.status} onChange={(e) => upd(r.id, { status: e.target.value as DepartureStatus })} className="min-h-11 rounded-sm border border-field px-2">
                    {DEPARTURE_STATUSES.map((s) => <option key={s} value={s}>{tt(`depStatuses.${s}`)}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input aria-label={tt("modifier")} type="number" min={-90} max={300} value={r.priceModifierPercent} onChange={(e) => upd(r.id, { priceModifierPercent: Number(e.target.value) })} className="min-h-11 w-20 rounded-sm border border-field px-2" /></td>
                <td className="flex gap-1 px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => call(`/api/admin/tours/${tourId}/departures/${r.id}`, { method: "PATCH", json: body(r) }, t("common.saved"))}>{t("common.save")}</Button>
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-danger/10"
                    onClick={async () => {
                      if (!confirm(t("common.confirmDelete"))) return;
                      if (await call(`/api/admin/tours/${tourId}/departures/${r.id}`, { method: "DELETE" }, t("common.saved"))) setRows(rows.filter((x) => x.id !== r.id));
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-danger" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-muted">{t("common.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

