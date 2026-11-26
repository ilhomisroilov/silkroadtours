"use client";

import { Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BUDGET_CATEGORIES, DAILY_MEALS_USD, dateOfDay, dayColor, type Budget } from "@/lib/trip-helpers";
import { formatDayDate } from "./builder-itinerary";

export function BuilderBudget({
  budget,
  money,
  includeMeals,
  setIncludeMeals,
  startDate,
}: {
  budget: Budget;
  money: (usd: number) => string;
  includeMeals: boolean;
  setIncludeMeals: (v: boolean) => void;
  startDate?: string;
}) {
  const t = useTranslations("tripBuilder.budget");
  const locale = useLocale();
  const maxCat = Math.max(1, ...BUDGET_CATEGORIES.map((c) => budget.byCategory[c]));
  const maxDay = Math.max(1, ...budget.byDay);
  const unitText = (l: Budget["lines"][number]) => {
    switch (l.unit) {
      case "night_room":
        return t("unit.nightRoom", { price: money(l.unitUsd), count: l.quantity, rooms: budget.rooms });
      case "person":
        return t("unit.person", { price: money(l.unitUsd), count: l.quantity });
      case "meal_person":
        return t("unit.mealPerson", { price: money(l.unitUsd), count: l.quantity });
      case "day_person":
        return t("unit.dayPerson", { price: money(l.unitUsd), days: budget.days, count: budget.travellers });
      case "group":
        return t("unit.group", { price: money(l.unitUsd) });
      default:
        return t("unit.trip", { price: money(l.unitUsd) });
    }
  };

  return (
    <section aria-labelledby="tb-budget" className="card overflow-hidden">
      <div className="bg-girih-dark on-dark p-5 text-white sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-saffron">{t("eyebrow")}</p>
          <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-saffron ring-1 ring-saffron/40">{t("estimate")}</span>
        </div>
        <h2 id="tb-budget" className="sr-only">
          {t("title")}
        </h2>
        <p className="mt-3 text-[2rem] font-extrabold leading-none" aria-live="polite">
          {money(budget.totalUsd)}
        </p>
        <p className="mt-2 text-sm text-white/80">
          {t("forGroup", { travellers: budget.travellers, days: budget.days, nights: budget.nights })} · {t("perPerson", { price: money(budget.perPersonUsd) })}
        </p>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-lapis)]" checked={includeMeals} onChange={(e) => setIncludeMeals(e.target.checked)} />
          <span>
            <span className="font-semibold text-ink">{t("meals")}</span>
            <span className="block text-ink-muted">{t("mealsHint", { price: money(DAILY_MEALS_USD) })}</span>
          </span>
        </label>

        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t("byCategory")}</h3>
          <ul className="mt-3 space-y-2.5">
            {BUDGET_CATEGORIES.filter((c) => budget.byCategory[c] > 0).map((c) => (
              <li key={c}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{t(`cat.${c}`)}</span>
                  <span className="font-bold text-lapis">{money(budget.byCategory[c])}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sky" aria-hidden="true">
                  <div className="h-full rounded-full bg-lapis" style={{ width: `${(budget.byCategory[c] / maxCat) * 100}%` }} />
                </div>
              </li>
            ))}
            {budget.totalUsd === 0 && <li className="text-sm text-ink-muted">{t("nothingYet")}</li>}
          </ul>
        </div>

        {budget.totalUsd > 0 && (
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-ink-muted">{t("byDay")}</h3>
            <ul className="mt-3 space-y-1.5">
              {budget.byDay.map((usd, d) => {
                if (d === 0 && usd === 0) return null;
                const date = d ? dateOfDay(startDate, d) : null;
                return (
                  <li key={d} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                    <span className="font-semibold text-ink">
                      {d ? t("dayN", { day: d }) : t("unscheduled")}
                      {date && <span className="block text-xs font-normal text-ink-muted">{formatDayDate(date, locale)}</span>}
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-sky" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${(usd / maxDay) * 100}%`, background: dayColor(d || undefined) }} />
                    </span>
                    <span className="font-bold text-lapis">{money(usd)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {budget.lines.length > 0 && (
          <details className="group rounded-2xl border border-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-lapis">
              <Wallet aria-hidden="true" className="size-4" /> {t("lines")}
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {budget.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{l.kind === "meals" ? t("meals") : l.title}</span>
                    <span className="block text-xs text-ink-muted">{unitText(l)}</span>
                  </span>
                  <span className="shrink-0 font-bold text-lapis">{money(l.usd)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-xs leading-relaxed text-ink-muted">
          {t("note", { rooms: budget.rooms })}
          {budget.unpriced > 0 && <> {t("unpriced", { count: budget.unpriced })}</>}
        </p>
      </div>
    </section>
  );
}
