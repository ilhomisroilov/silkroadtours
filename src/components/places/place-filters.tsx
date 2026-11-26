"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { NativeSelect } from "@/components/ui/form";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

export type FilterField =
  | { kind: "search"; name: string; label: string; placeholder?: string }
  | { kind: "select"; name: string; label: string; any: string; options: Option[] }
  | { kind: "range"; min: string; max: string; label: string; minLabel: string; maxLabel: string }
  | { kind: "chips"; name: string; label: string; any: string; options: Option[] }
  | { kind: "checks"; name: string; label: string; options: Option[] };

export type FilterValues = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Filter panel for the hotel and restaurant lists. Every change updates the URL (shareable, back-button
 * friendly) and the server re-renders the results; without JavaScript the form submits as a normal GET.
 */
export function PlaceFilters({
  fields,
  values,
  sort,
  labels,
  resultsLabel,
  children,
}: {
  fields: FilterField[];
  values: FilterValues;
  sort: { name: string; label: string; options: Option[] };
  labels: { title: string; apply: string; reset: string; show: string };
  resultsLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Re-mounting the uncontrolled fields clears them after "reset".
  const [formKey, setFormKey] = useState(0);

  const navigate = () => {
    const form = formRef.current;
    if (!form) return;
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v.trim()) qs.append(k, v.trim());
    const s = qs.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const schedule = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(navigate, delay);
  };

  const active = fields.reduce((n, f) => {
    if (f.kind === "range") return n + (one(values[f.min]) || one(values[f.max]) ? 1 : 0);
    if (f.kind === "checks") return n + many(values[f.name]).length;
    return n + (one(values[f.name]) ? 1 : 0);
  }, 0);

  const reset = () => {
    const s = one(values[sort.name]);
    setFormKey((k) => k + 1);
    startTransition(() => router.replace(s ? `${pathname}?${sort.name}=${encodeURIComponent(s)}` : pathname, { scroll: false }));
  };

  const chip = "inline-flex min-h-10 cursor-pointer items-center rounded-full border border-field bg-white px-3.5 text-sm font-semibold text-ink transition has-[:checked]:border-lapis-deep has-[:checked]:bg-lapis-deep has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cobalt has-[:focus-visible]:ring-offset-2";

  const fieldsUi = fields.map((f) => {
    if (f.kind === "search")
      return (
        <div key={f.name}>
          <label htmlFor={`pf-${f.name}`} className="mb-1.5 block text-sm font-semibold">
            {f.label}
          </label>
          <input
            id={`pf-${f.name}`}
            name={f.name}
            type="search"
            defaultValue={one(values[f.name])}
            placeholder={f.placeholder}
            onChange={() => schedule(450)}
            className="block min-h-11 w-full rounded-sm border border-field bg-white px-3.5 focus-visible:border-cobalt"
          />
        </div>
      );
    if (f.kind === "select")
      return (
        <div key={f.name}>
          <label htmlFor={`pf-${f.name}`} className="mb-1.5 block text-sm font-semibold">
            {f.label}
          </label>
          <NativeSelect id={`pf-${f.name}`} name={f.name} defaultValue={one(values[f.name])} onChange={() => schedule(0)}>
            <option value="">{f.any}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      );
    if (f.kind === "range")
      return (
        <fieldset key={f.min}>
          <legend className="mb-1.5 text-sm font-semibold">{f.label}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [f.min, f.minLabel],
                [f.max, f.maxLabel],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-1 block text-xs text-ink-muted">{label}</span>
                <input
                  name={name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  defaultValue={one(values[name])}
                  onChange={() => schedule(600)}
                  className="block min-h-11 w-full rounded-sm border border-field bg-white px-3 focus-visible:border-cobalt"
                />
              </label>
            ))}
          </div>
        </fieldset>
      );
    if (f.kind === "chips")
      return (
        <fieldset key={f.name}>
          <legend className="mb-2 text-sm font-semibold">{f.label}</legend>
          <div className="flex flex-wrap gap-2">
            {[{ value: "", label: f.any }, ...f.options].map((o) => (
              <label key={o.value || "any"} className={chip}>
                <input type="radio" name={f.name} value={o.value} defaultChecked={one(values[f.name]) === o.value} onChange={() => schedule(0)} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    return (
      <fieldset key={f.name}>
        <legend className="mb-2 text-sm font-semibold">{f.label}</legend>
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <label key={o.value} className={chip}>
              <input type="checkbox" name={f.name} value={o.value} defaultChecked={many(values[f.name]).includes(o.value)} onChange={() => schedule(250)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="place-filters"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-lapis-deep px-4 text-sm font-bold text-lapis-deep lg:hidden"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {labels.show}
          {active > 0 && <span className="rounded-full bg-terracotta px-1.5 text-xs text-white">{active}</span>}
        </button>
        <form
          key={formKey}
          id="place-filters"
          ref={formRef}
          method="get"
          role="search"
          aria-label={labels.title}
          onSubmit={(e) => {
            e.preventDefault();
            navigate();
            setOpen(false);
          }}
          className={cn(
            "mt-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card lg:sticky lg:top-24 lg:mt-0 lg:block",
            open ? "block" : "hidden",
          )}
        >
          <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-bold text-lapis-deep">
            <SlidersHorizontal aria-hidden="true" className="size-5" /> {labels.title}
          </h2>
          <input type="hidden" name={sort.name} value={one(values[sort.name])} />
          <div className="grid gap-5">{fieldsUi}</div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-lapis-deep px-5 text-sm font-bold text-white hover:bg-cobalt">
              {labels.apply}
            </button>
            {active > 0 && (
              <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-cobalt underline">
                <X aria-hidden="true" className="size-4" /> {labels.reset}
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-ink" aria-live="polite" data-testid="results-count">
            {resultsLabel}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-ink-muted">{sort.label}</span>
            <NativeSelect
              value={one(values[sort.name]) || sort.options[0]?.value}
              onChange={(e) => {
                const hidden = formRef.current?.elements.namedItem(sort.name) as HTMLInputElement | null;
                if (hidden) hidden.value = e.target.value;
                navigate();
              }}
              className="w-auto min-w-44 rounded-full py-2 text-sm font-semibold"
            >
              {sort.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-50")}>
          {children}
        </div>
      </div>
    </div>
  );
}
