"use client";

import { X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/** Three tour selects that rewrite ?tours=a,b,c. */
export function ComparePicker({
  options,
  selected,
  labels,
}: {
  options: { slug: string; title: string }[];
  selected: string[];
  labels: { slot: string; choose: string; remove: string };
}) {
  const router = useRouter();
  const go = (next: string[]) => {
    const tours = next.filter(Boolean);
    router.replace(tours.length ? { pathname: "/compare", query: { tours: tours.join(",") } } : "/compare", { scroll: false });
  };
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => {
        const value = selected[i] ?? "";
        const label = labels.slot.replace("{n}", String(i + 1));
        return (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-card">
            <label className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-cobalt">{label}</span>
              <select
                value={value}
                onChange={(e) => {
                  const next = [...selected];
                  next[i] = e.target.value;
                  go(next);
                }}
                className="h-10 w-full truncate bg-transparent pr-2 font-semibold text-lapis focus:outline-none"
              >
                <option value="">{labels.choose}</option>
                {options.map((o) => (
                  <option key={o.slug} value={o.slug} disabled={selected.includes(o.slug) && o.slug !== value}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
            {value && (
              <button
                type="button"
                onClick={() => go(selected.filter((_, k) => k !== i))}
                aria-label={`${labels.remove}: ${options.find((o) => o.slug === value)?.title ?? value}`}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-cobalt"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
