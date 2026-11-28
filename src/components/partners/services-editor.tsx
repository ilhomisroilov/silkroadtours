"use client";

import { GlassSelect } from "@/components/ui/glass-select";
import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { SERVICE_UNITS, type PartnerService, type ServiceUnit } from "@/lib/partners";

export interface ServicesEditorLabels {
  serviceName: string;
  placeholder: string;
  price: string;
  unit: string;
  noUnit: string;
  add: string;
  /** "Remove service {n}" with {n} already replaced is built by the caller. */
  remove: (n: number) => string;
  serviceN: (n: number) => string;
  units: Record<ServiceUnit, string>;
}

export const emptyService = (): PartnerService => ({ name: "", priceFromUsd: null, unit: null });

const control =
  "block w-full min-h-11 rounded-sm border border-field bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted/80 focus-visible:border-cobalt aria-[invalid=true]:border-danger";

/**
 * Add / remove / edit a partner's service lines (name, indicative "from" price in USD, unit).
 * Controlled: the parent owns the list. Used on the application form, the partner dashboard and in the admin panel.
 */
export function ServicesEditor({
  value,
  onChange,
  labels,
  errors,
  max = 20,
  disabled,
}: {
  value: PartnerService[];
  onChange: (next: PartnerService[]) => void;
  labels: ServicesEditorLabels;
  /** Error text per row index. */
  errors?: Record<number, string | undefined>;
  max?: number;
  disabled?: boolean;
}) {
  const base = useId();
  const set = (i: number, patch: Partial<PartnerService>) => onChange(value.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {value.map((s, i) => {
          const id = `${base}-${i}`;
          const err = errors?.[i];
          return (
            <li key={i} className="rounded-sm border border-line bg-sand-soft/60 p-3" data-testid="service-row">
              <fieldset className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_8.5rem_auto]">
                <legend className="sr-only">{labels.serviceN(i + 1)}</legend>
                <div className="col-span-3 sm:col-span-1">
                  <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-semibold">{labels.serviceName}</label>
                  <input
                    id={`${id}-name`}
                    value={s.name}
                    maxLength={120}
                    disabled={disabled}
                    placeholder={labels.placeholder}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${id}-error` : undefined}
                    onChange={(e) => set(i, { name: e.target.value })}
                    className={control}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-price`} className="mb-1 block text-sm font-semibold">{labels.price}</label>
                  <input
                    id={`${id}-price`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100000}
                    step={1}
                    disabled={disabled}
                    value={s.priceFromUsd ?? ""}
                    onChange={(e) => {
                      const n = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
                      set(i, { priceFromUsd: n != null && Number.isFinite(n) ? n : null });
                    }}
                    className={control}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-unit`} className="mb-1 block text-sm font-semibold">{labels.unit}</label>
                  <GlassSelect id={`${id}-unit`} value={s.unit ?? ""} disabled={disabled} onChange={(e) => set(i, { unit: (e.target.value || null) as ServiceUnit | null })} className={control}>
                    <option value="">{labels.noUnit}</option>
                    {SERVICE_UNITS.map((u) => (
                      <option key={u} value={u}>{labels.units[u]}</option>
                    ))}
                  </GlassSelect>
                </div>
                <button
                  type="button"
                  disabled={disabled || value.length <= 1}
                  onClick={() => onChange(value.filter((_, k) => k !== i))}
                  className="inline-flex size-11 items-center justify-center justify-self-end rounded-full text-danger hover:bg-danger/10 disabled:opacity-40"
                  aria-label={labels.remove(i + 1)}
                  data-testid="service-remove"
                >
                  <Trash2 aria-hidden="true" className="size-5" />
                </button>
              </fieldset>
              {err && (
                <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-danger">{err}</p>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        disabled={disabled || value.length >= max}
        onClick={() => onChange([...value, emptyService()])}
        className={cn("inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-lapis/30 bg-white px-4 text-sm font-bold text-lapis hover:bg-sky disabled:opacity-50")}
        data-testid="service-add"
      >
        <Plus aria-hidden="true" className="size-4" /> {labels.add}
      </button>
    </div>
  );
}
