"use client";

import { CalendarDays, Check, ChevronDown, MapPin, Minus, Plus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { addDaysIso, daysFromDates, MAX_TRIP_DAYS, MAX_TRIP_DESTINATIONS, type DestinationPoint } from "@/lib/trip-helpers";
import type { TripState } from "@/lib/trip-store";
import { todayInTashkent } from "@/validators/common";

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const t = useTranslations("tripBuilder.setup");
  const btn =
    "inline-flex size-11 items-center justify-center rounded-full bg-sky text-lapis transition hover:bg-lapis hover:text-white disabled:opacity-40 disabled:hover:bg-sky disabled:hover:text-lapis";
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t("decrease", { label })}>
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <span className="min-w-7 text-center text-lg font-extrabold text-lapis" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t("increase", { label })}>
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/** On one line (xl) Dates and Travellers carry a small sub-label row (From/To, Adults/Children); this gap keeps
 *  Trip name and Destinations on the same baseline as their fields. */
const SUBLABEL_GAP = "xl:mt-[calc(0.8125rem*1.4+0.25rem)]";
const inputCls =
  "min-h-11 w-full rounded-xl border border-field bg-white px-3 text-base text-ink focus-visible:border-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/30";

/** Trip name, destinations (multi-select), dates and travellers. */
export function BuilderSetup({
  trip,
  destinations,
  update,
}: {
  trip: TripState;
  destinations: DestinationPoint[];
  update: (fn: (t: TripState) => TripState) => void;
}) {
  const t = useTranslations("tripBuilder.setup");
  const byName = new Map(destinations.map((d) => [d.slug, d.name]));
  const today = todayInTashkent();
  const days = daysFromDates(trip.startDate, trip.endDate);
  const toggleDest = (slug: string) =>
    update((s) => {
      const on = s.destinations.includes(slug);
      if (!on && s.destinations.length >= MAX_TRIP_DESTINATIONS) return s;
      return { ...s, destinations: on ? s.destinations.filter((d) => d !== slug) : [...s.destinations, slug] };
    });
  const setStart = (v: string) =>
    update((s) => {
      if (!v) return { ...s, startDate: undefined };
      const prev = daysFromDates(s.startDate, s.endDate) ?? 4;
      let end = s.endDate && s.endDate >= v ? s.endDate : addDaysIso(v, prev - 1);
      const maxEnd = addDaysIso(v, MAX_TRIP_DAYS - 1);
      if (end > maxEnd) end = maxEnd;
      return { ...s, startDate: v, endDate: end };
    });
  const setEnd = (v: string) => update((s) => ({ ...s, endDate: v || undefined }));
  const groups = [
    { key: "uzbekistan", items: destinations.filter((d) => !d.abroad) },
    { key: "abroad", items: destinations.filter((d) => d.abroad) },
  ].filter((g) => g.items.length);

  return (
    <section aria-labelledby="tb-setup" className="card relative z-10 -mt-8 p-4 sm:p-6">
      <h2 id="tb-setup" className="eyebrow mb-3 text-cobalt">
        {t("title")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(18rem,1.2fr)_auto] xl:items-start">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          {t("name")}
          <input
            className={`${inputCls} ${SUBLABEL_GAP}`}
            value={trip.title}
            maxLength={120}
            placeholder={t("namePlaceholder")}
            onChange={(e) => {
              const v = e.target.value;
              update((s) => ({ ...s, title: v }));
            }}
          />
        </label>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span id="tb-dest-label" className="text-sm font-semibold text-ink">
            {t("destinations")}
          </span>
          <Popover>
            <PopoverTrigger
              aria-labelledby="tb-dest-label tb-dest-value"
              className={`${SUBLABEL_GAP} flex min-h-11 w-full items-center gap-2 rounded-xl border border-field bg-white px-3 text-left text-base text-ink hover:border-cobalt`}
            >
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-cobalt" />
              <span id="tb-dest-value" className="min-w-0 flex-1 truncate">
                {trip.destinations.length ? trip.destinations.map((d) => byName.get(d) ?? d).join(", ") : t("destinationsPlaceholder")}
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            </PopoverTrigger>
            <PopoverContent className="max-h-[min(70dvh,30rem)] w-[min(92vw,26rem)] overflow-y-auto p-4">
              <p className="mb-3 text-sm text-ink-muted">{t("destinationsHint", { max: MAX_TRIP_DESTINATIONS })}</p>
              {groups.map((g) => (
                <fieldset key={g.key} className="mb-3 last:mb-0">
                  <legend className="eyebrow mb-2 text-cobalt">{t(`group.${g.key}` as "group.uzbekistan")}</legend>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {g.items.map((d) => {
                      const on = trip.destinations.includes(d.slug);
                      const full = !on && trip.destinations.length >= MAX_TRIP_DESTINATIONS;
                      return (
                        <li key={d.slug}>
                          <label
                            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold transition ${on ? "border-lapis bg-sky text-lapis" : "border-line bg-white text-ink hover:border-cobalt/50"} ${full ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <input type="checkbox" className="size-4 accent-[var(--color-lapis)]" checked={on} disabled={full} onChange={() => toggleDest(d.slug)} />
                            <span className="min-w-0 truncate">{d.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ))}
            </PopoverContent>
          </Popover>
          {trip.destinations.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={t("chosen")}>
              {trip.destinations.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => toggleDest(d)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full bg-lapis px-3 text-xs font-bold text-white hover:bg-cobalt"
                    aria-label={t("removeDestination", { name: byName.get(d) ?? d })}
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                    {byName.get(d) ?? d}
                    <X aria-hidden="true" className="size-3.5 opacity-80" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CalendarDays aria-hidden="true" className="size-4 text-cobalt" /> {t("dates")}
            {days && <span className="font-normal text-ink-muted">· {t("daysCount", { count: days })}</span>}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
              {t("start")}
              <input type="date" className={inputCls} min={today} value={trip.startDate ?? ""} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
              {t("end")}
              <input
                type="date"
                className={inputCls}
                min={trip.startDate ?? today}
                max={trip.startDate ? addDaysIso(trip.startDate, MAX_TRIP_DAYS - 1) : undefined}
                value={trip.endDate ?? ""}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Users aria-hidden="true" className="size-4 text-cobalt" /> {t("travellers")}
          </legend>
          <div className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
            {t("adults")}
            <Stepper value={trip.adults} min={1} max={20} label={t("adults")} onChange={(v) => update((s) => ({ ...s, adults: v }))} />
          </div>
          <div className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
            {t("children")}
            <Stepper value={trip.children} min={0} max={10} label={t("children")} onChange={(v) => update((s) => ({ ...s, children: v }))} />
          </div>
        </fieldset>
      </div>
    </section>
  );
}
