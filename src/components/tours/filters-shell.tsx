"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export interface FilterValues {
  audience?: string;
  destination?: string;
  category?: string;
  month?: string;
  guests?: string;
  maxDays?: string;
  q?: string;
  sort?: string;
}

interface Option {
  value: string;
  label: string;
}

export interface FilterOptions {
  audiences: Option[];
  destinations: Option[];
  categories: Option[];
  months: Option[];
  durations: Option[];
  sorts: Option[];
}

const KEYS: (keyof FilterValues)[] = ["audience", "destination", "category", "month", "guests", "maxDays", "q", "sort"];

function FilterFields({
  idPrefix,
  values,
  options,
  onChange,
}: {
  idPrefix: string;
  values: FilterValues;
  options: FilterOptions;
  onChange: (key: keyof FilterValues, value: string, immediate?: boolean) => void;
}) {
  const t = useTranslations("tours");
  const select = (key: keyof FilterValues, label: string, opts: Option[], any: string) => (
    <div>
      <label htmlFor={`${idPrefix}-${key}`} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <NativeSelect
        id={`${idPrefix}-${key}`}
        name={key}
        value={values[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value, true)}
      >
        <option value="">{any}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </NativeSelect>
    </div>
  );
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={`${idPrefix}-q`} className="mb-1.5 block text-sm font-semibold">{t("searchLabel")}</label>
        <input
          id={`${idPrefix}-q`}
          name="q"
          type="search"
          value={values.q ?? ""}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => onChange("q", e.target.value)}
          className="block min-h-11 w-full rounded-sm border border-field bg-white px-3.5"
        />
      </div>
      {select("audience", t("audience"), options.audiences, t("anyAudience"))}
      {select("destination", t("destination"), options.destinations, t("anyDestination"))}
      {select("category", t("category"), options.categories, t("anyCategory"))}
      {select("month", t("month"), options.months, t("anyMonth"))}
      <div>
        <label htmlFor={`${idPrefix}-guests`} className="mb-1.5 block text-sm font-semibold">{t("guests")}</label>
        <input
          id={`${idPrefix}-guests`}
          name="guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={values.guests ?? ""}
          onChange={(e) => onChange("guests", e.target.value)}
          className="block min-h-11 w-full rounded-sm border border-field bg-white px-3.5"
        />
      </div>
      {select("maxDays", t("duration"), options.durations, t("anyDuration"))}
    </div>
  );
}

/**
 * Filter form + results region. Every change updates the URL (shareable, back-button friendly);
 * without JavaScript the form still submits as a normal GET request.
 */
export function FiltersShell({
  values: initial,
  options,
  action,
  resultsLabel,
  children,
}: {
  values: FilterValues;
  options: FilterOptions;
  action: string;
  resultsLabel: string;
  children: ReactNode;
}) {
  const t = useTranslations("tours");
  const tn = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState<FilterValues>(initial);
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValues(initial), [initial]);

  const navigate = (next: FilterValues) => {
    const query: Record<string, string> = {};
    for (const k of KEYS) if (next[k]) query[k] = next[k]!;
    startTransition(() => router.replace({ pathname, query }, { scroll: false }));
  };

  const onChange = (key: keyof FilterValues, value: string, immediate = false) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) navigate(next);
    else timer.current = setTimeout(() => navigate(next), 450);
  };

  const activeCount = KEYS.filter((k) => k !== "sort" && values[k]).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block" aria-label={t("filters")}>
        <form action={action} method="get" className="sticky top-6 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card" onSubmit={(e) => { e.preventDefault(); navigate(values); }}>
          <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-bold text-lapis-deep">
            <SlidersHorizontal aria-hidden="true" className="size-5" /> {t("filters")}
          </h2>
          <FilterFields idPrefix="f" values={values} options={options} onChange={onChange} />
          <noscript>
            <button type="submit" className="mt-4 min-h-11 w-full rounded-full bg-lapis font-semibold text-white">{t("applyFilters")}</button>
          </noscript>
          {activeCount > 0 && (
            <button type="button" onClick={() => { const v = { sort: values.sort }; setValues(v); navigate(v); }} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-cobalt underline">
              <X aria-hidden="true" className="size-4" /> {t("resetFilters")}
            </button>
          )}
        </form>
      </aside>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-ink" aria-live="polite" data-testid="results-count">{resultsLabel}</p>
          <div className="flex items-center gap-2">
            <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal aria-hidden="true" /> {t("filters")}
                  {activeCount > 0 && <span className="rounded-full bg-terracotta px-1.5 text-xs text-white">{activeCount}</span>}
                </Button>
              </DialogTrigger>
              <SheetContent side="bottom" closeLabel={tn("close")} aria-describedby={undefined} className="p-5">
                <DialogTitle className="mb-4">{t("filters")}</DialogTitle>
                <FilterFields idPrefix="m" values={values} options={options} onChange={onChange} />
                <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 border-t border-line bg-ivory px-5 py-4">
                  <Button variant="ghost" onClick={() => { const v = { sort: values.sort }; setValues(v); navigate(v); }}>{t("resetFilters")}</Button>
                  <Button className="flex-1" onClick={() => setSheetOpen(false)}>{t("applyFilters")}</Button>
                </div>
              </SheetContent>
            </Dialog>
            <label htmlFor="sort" className="sr-only">{t("sort")}</label>
            <NativeSelect id="sort" value={values.sort ?? "featured"} onChange={(e) => onChange("sort", e.target.value, true)} className="w-auto min-w-48 rounded-full py-2 text-sm font-semibold">
              {options.sorts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div aria-busy={pending} className="relative">
          <div className={cn("transition-opacity", pending && "opacity-40")}>{children}</div>
          {pending && (
            <div className="pointer-events-none absolute inset-x-0 top-0 grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-96" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
