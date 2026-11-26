import Link from "next/link";
import type { ReactNode } from "react";

/** Plain GET filter form: filters live in the URL, so lists are shareable and work without JS. */
export function FilterBar({ children, submitLabel }: { children: ReactNode; submitLabel: string }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-line bg-white p-4 shadow-sm">
      {children}
      <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 font-semibold text-white hover:bg-lapis-deep">{submitLabel}</button>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

export const filterInput = "min-h-11 rounded-sm border border-field bg-white px-3 font-normal";

export function Pager({ page, pageSize, total, base, params, labels }: { page: number; pageSize: number; total: number; base: string; params: Record<string, string | undefined>; labels: { prev: string; next: string; page: string } }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${base}?${sp}`;
  };
  return (
    <nav aria-label={labels.page} className="mt-4 flex items-center justify-between text-sm">
      <span className="text-ink-muted">{labels.page}</span>
      <span className="flex gap-2">
        {page > 1 && <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 font-semibold" href={href(page - 1)}>← {labels.prev}</Link>}
        {page < pages && <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 font-semibold" href={href(page + 1)}>{labels.next} →</Link>}
      </span>
    </nav>
  );
}
