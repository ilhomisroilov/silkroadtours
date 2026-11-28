import Link from "next/link";
import type { ReactNode } from "react";

/** Plain GET filter form: filters live in the URL, so lists are shareable and work without JS. */
export function FilterBar({ children, submitLabel }: { children: ReactNode; submitLabel: string }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-[var(--adm-surface)] p-4">
      {children}
      <button type="submit" className="inline-flex h-10 items-center rounded-md bg-[#176bcb] px-4 font-medium text-white shadow-sm transition hover:bg-[#3b88dd]">{submitLabel}</button>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold max-sm:w-full">
      {label}
      {children}
    </label>
  );
}

export const filterInput = "h-10 max-w-full rounded-md border border-[var(--adm-field-border)] bg-[var(--adm-field)] px-3 font-normal transition hover:border-[#4096ff] focus:border-[#176bcb] focus:outline-none focus:ring-2 focus:ring-[#176bcb]/20";

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
        {page > 1 && <Link className="inline-flex h-10 items-center rounded-md border border-[var(--adm-field-border)] bg-[var(--adm-surface)] px-4 font-medium hover:border-[#4096ff] hover:text-[#176bcb]" href={href(page - 1)}>← {labels.prev}</Link>}
        {page < pages && <Link className="inline-flex h-10 items-center rounded-md border border-[var(--adm-field-border)] bg-[var(--adm-surface)] px-4 font-medium hover:border-[#4096ff] hover:text-[#176bcb]" href={href(page + 1)}>{labels.next} →</Link>}
      </span>
    </nav>
  );
}
