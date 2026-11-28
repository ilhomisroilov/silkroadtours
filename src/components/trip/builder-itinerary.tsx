"use client";

import { GlassSelect } from "@/components/ui/glass-select";
import { ArrowDown, ArrowUp, Compass, Trash2, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { dateOfDay, dayColor, itemHref, MAX_TRIP_DAYS, daysFromDates } from "@/lib/trip-helpers";
import type { TripItem, TripState } from "@/lib/trip-store";
import { KindIcon } from "./kind-icon";

export function formatDayDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "uz" ? "uz-Latn" : locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

function moveWithinDay(items: TripItem[], id: string, dir: -1 | 1, dayCount: number): TripItem[] {
  const dayOf = (i: TripItem) => (i.day && i.day <= dayCount ? i.day : 0);
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return items;
  const d = dayOf(items[idx]!);
  let j = idx + dir;
  while (j >= 0 && j < items.length && dayOf(items[j]!) !== d) j += dir;
  if (j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return next;
}

export function BuilderItinerary({
  trip,
  dayCount,
  update,
  priceLabel,
  destinationName,
  onAutoArrange,
  onQuickStart,
  quickStart,
}: {
  trip: TripState;
  dayCount: number;
  update: (fn: (t: TripState) => TripState) => void;
  priceLabel: (i: TripItem) => string | null;
  destinationName: (slug: string) => string;
  onAutoArrange: () => void;
  onQuickStart: (slugs: string[]) => void;
  quickStart: { key: string; slugs: string[] }[];
}) {
  const t = useTranslations("tripBuilder.itinerary");
  const tk = useTranslations("tripBuilder.catalogue.kind");
  const locale = useLocale();
  const hasDates = !!daysFromDates(trip.startDate, trip.endDate);
  const maxOption = hasDates ? dayCount : Math.min(MAX_TRIP_DAYS, dayCount + 1);
  const dayOf = (i: TripItem) => (i.day && i.day <= dayCount ? i.day : 0);
  const unscheduled = trip.items.filter((i) => dayOf(i) === 0);
  const setDay = (id: string, day: number) => update((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, day: day || undefined } : i)) }));
  const remove = (id: string) => update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  const move = (id: string, dir: -1 | 1) => update((s) => ({ ...s, items: moveWithinDay(s.items, id, dir, dayCount) }));
  const iconBtn = "inline-flex size-10 items-center justify-center rounded-full text-ink-muted transition hover:bg-sky hover:text-lapis disabled:opacity-30 disabled:hover:bg-transparent";

  const row = (item: TripItem, list: TripItem[], pos: number) => {
    const href = itemHref(item);
    const price = priceLabel(item);
    return (
      <li key={item.id} className="rounded-2xl border border-line bg-white p-3">
        <div className="flex items-start gap-3">
          <KindIcon kind={item.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {tk(item.kind)}
              {item.destinationSlug && <> · {destinationName(item.destinationSlug)}</>}
            </p>
            {href ? (
              <Link href={href} className="font-bold leading-snug text-lapis hover:underline">
                {item.title}
              </Link>
            ) : (
              <p className="font-bold leading-snug text-lapis">{item.title}</p>
            )}
            {item.meta && <p className="line-clamp-1 text-sm text-ink-muted">{item.meta}</p>}
            {price && <p className="text-sm font-semibold text-saffron-ink">{price}</p>}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
          <label className="sr-only" htmlFor={`day-${item.id}`}>
            {t("dayFor", { title: item.title })}
          </label>
          <GlassSelect
            id={`day-${item.id}`}
            value={dayOf(item)}
            onChange={(e) => setDay(item.id, Number(e.target.value))}
            className="min-h-10 min-w-0 flex-1 rounded-full border border-field bg-white px-3 text-sm font-semibold text-lapis focus-visible:border-cobalt"
          >
            <option value={0}>{t("notScheduled")}</option>
            {Array.from({ length: maxOption }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {t("dayN", { day: d })}
              </option>
            ))}
          </GlassSelect>
          <button type="button" className={iconBtn} onClick={() => move(item.id, -1)} disabled={pos === 0} aria-label={t("moveUp", { title: item.title })}>
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
          <button type="button" className={iconBtn} onClick={() => move(item.id, 1)} disabled={pos === list.length - 1} aria-label={t("moveDown", { title: item.title })}>
            <ArrowDown aria-hidden="true" className="size-4" />
          </button>
          <button type="button" className={`${iconBtn} hover:bg-danger/10 hover:text-danger`} onClick={() => remove(item.id)} aria-label={t("remove", { title: item.title })}>
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </li>
    );
  };

  if (trip.items.length === 0) {
    return (
      <section aria-labelledby="tb-itinerary" className="card overflow-hidden">
        <div className="bg-girih-dark on-dark p-5 text-white sm:p-6">
          <p className="eyebrow text-saffron">{t("eyebrow")}</p>
          <h2 id="tb-itinerary" className="mt-1.5 text-2xl text-white">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-white/80">{t("emptyText")}</p>
        </div>
        <ol className="space-y-3 p-5 sm:p-6">
          {(["step1", "step2", "step3", "step4"] as const).map((s, i) => (
            <li key={s} className="flex gap-3">
              <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky text-sm font-extrabold text-lapis">
                {i + 1}
              </span>
              <span className="pt-1 text-sm text-ink">{t(`emptySteps.${s}`)}</span>
            </li>
          ))}
        </ol>
        {quickStart.length > 0 && (
          <div className="border-t border-line p-5 sm:p-6">
            <p className="text-sm font-semibold text-ink">{t("quickStart")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickStart.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => onQuickStart(q.slugs)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sky px-4 text-sm font-semibold text-lapis transition hover:bg-lapis hover:text-white"
                >
                  <Compass aria-hidden="true" className="size-4" />
                  {q.slugs.map(destinationName).join(" · ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="tb-itinerary" className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
          <h2 id="tb-itinerary" className="mt-1.5 text-2xl text-lapis">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t("summary", { days: dayCount, items: trip.items.length })}</p>
        </div>
        <button type="button" onClick={onAutoArrange} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-4 text-sm font-bold text-lapis-deep transition hover:bg-saffron-soft">
          <Wand2 aria-hidden="true" className="size-4" /> {t("autoArrange")}
        </button>
      </div>
      {!hasDates && <p className="mt-3 rounded-xl bg-sky/70 px-3 py-2 text-sm text-ink">{t("noDates", { days: dayCount })}</p>}

      {unscheduled.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-field/60 bg-sand-soft p-3">
          <h3 className="flex items-center justify-between gap-2 text-sm font-extrabold text-ink">
            {t("unscheduled", { count: unscheduled.length })}
          </h3>
          <p className="mb-2 text-xs text-ink-muted">{t("unscheduledHint")}</p>
          <ul className="space-y-2">{unscheduled.map((i, pos) => row(i, unscheduled, pos))}</ul>
        </div>
      )}

      <ol className="mt-4 space-y-4">
        {Array.from({ length: dayCount }, (_, k) => k + 1).map((d) => {
          const list = trip.items.filter((i) => dayOf(i) === d);
          const date = dateOfDay(trip.startDate, d);
          const places = [...new Set(list.map((i) => i.destinationSlug).filter(Boolean) as string[])].map(destinationName);
          return (
            <li key={d}>
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-base">
                <span className="inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-extrabold text-white" style={{ background: dayColor(d) }}>
                  {t("dayN", { day: d })}
                </span>
                {date && <span className="text-sm font-semibold text-ink">{formatDayDate(date, locale)}</span>}
                {places.length > 0 && <span className="text-sm text-ink-muted">· {places.join(", ")}</span>}
              </h3>
              {list.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted">{t("freeDay")}</p>
              ) : (
                <ul className="mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: dayColor(d) }}>
                  {list.map((i, pos) => row(i, list, pos))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
