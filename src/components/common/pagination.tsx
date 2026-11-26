import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function Pagination({
  page,
  pageCount,
  pathname,
  query,
  labels,
}: {
  page: number;
  pageCount: number;
  pathname: string;
  query: Record<string, string | undefined>;
  labels: { nav: string; previous: string; next: string; page: (n: number) => string };
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) if (v) q[k] = v;
    if (p > 1) q.page = String(p);
    return { pathname, query: q };
  };
  const cls = "inline-flex size-11 items-center justify-center rounded-full font-semibold";
  return (
    <nav aria-label={labels.nav} className="mt-12 flex justify-center">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} className={cn(cls, "text-lapis hover:bg-sand-soft")} aria-label={labels.previous} rel="prev">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <span className={cn(cls, "text-ink-muted/50")} aria-hidden="true"><ChevronLeft className="size-5" /></span>
          )}
        </li>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <li key={p}>
            <Link
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={labels.page(p)}
              className={cn(cls, p === page ? "bg-lapis text-white" : "text-ink hover:bg-sand-soft")}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < pageCount ? (
            <Link href={href(page + 1)} className={cn(cls, "text-lapis hover:bg-sand-soft")} aria-label={labels.next} rel="next">
              <ChevronRight aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <span className={cn(cls, "text-ink-muted/50")} aria-hidden="true"><ChevronRight className="size-5" /></span>
          )}
        </li>
      </ul>
    </nav>
  );
}
