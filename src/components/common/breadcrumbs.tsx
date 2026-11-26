import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/cn";

/** Visible breadcrumb trail + BreadcrumbList JSON-LD. The last item is the current page. */
export function Breadcrumbs({
  items,
  label,
  base,
  tone = "light",
}: {
  items: { name: string; href: string }[];
  label: string;
  base: string;
  tone?: "light" | "dark";
}) {
  return (
    <>
      <nav aria-label={label}>
        <ol className={cn("flex flex-wrap items-center gap-1 text-sm", tone === "dark" ? "text-sand" : "text-ink-muted")}>
          {items.map((it, i) => (
            <li key={it.href} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 opacity-70" />}
              {i === items.length - 1 ? (
                <span aria-current="page" className={cn("font-semibold", tone === "dark" ? "text-ivory" : "text-ink")}>{it.name}</span>
              ) : (
                <Link href={it.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{it.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <BreadcrumbJsonLd items={items.map((it) => ({ name: it.name, url: `${base}${it.href === "/" ? "" : it.href}` }))} />
    </>
  );
}
