"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type NavChild = { href: string; label: string; hint?: string; group?: string };
export type NavItem = { href: string; label: string; children?: NavChild[]; footer?: { href: string; label: string } };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const itemCls =
  "relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-1.5 text-[0.875rem] font-semibold text-ink transition-colors hover:text-cobalt 2xl:px-3 2xl:text-[0.95rem] after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-cobalt after:transition-transform";

function Dropdown({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = new Map<string, NavChild[]>();
  for (const c of item.children ?? []) {
    const g = c.group ?? "";
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  const multi = groups.size > 1;

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        window.clearTimeout(timer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        timer.current = window.setTimeout(() => setOpen(false), 140);
      }}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(itemCls, (active || open) && "text-cobalt", active && "after:scale-x-100")}
      >
        {item.label}
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} hidden={!open} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2">
        <div className={cn("rounded-2xl bg-white p-3 shadow-lift ring-1 ring-lapis/8", multi ? "w-[34rem]" : "w-[22rem]")}>
          <div className={cn("grid gap-3", multi && "grid-cols-2")}>
            {[...groups.entries()].map(([group, children]) => (
              <div key={group}>
                {group && <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{group}</p>}
                <ul>
                  {children.map((c) => (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        className={cn(
                          "block rounded-xl px-3 py-2.5 hover:bg-sky",
                          isActive(pathname, c.href) && "bg-sky",
                        )}
                      >
                        <span className="block text-[0.95rem] font-semibold text-ink">{c.label}</span>
                        {c.hint && <span className="mt-0.5 block text-sm text-ink-muted">{c.hint}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {item.footer && (
            <Link
              href={item.footer.href}
              className="mt-2 flex items-center justify-between rounded-xl bg-sky px-3 py-2.5 text-sm font-bold text-cobalt hover:bg-lapis-mist"
            >
              {item.footer.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export function DesktopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden xl:block">
      <ul className="flex items-center gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href) || !!item.children?.some((c) => isActive(pathname, c.href));
          return item.children?.length ? (
            <Dropdown key={item.href} item={item} active={active} />
          ) : (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(itemCls, active && "text-cobalt after:scale-x-100")}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Transparent over the home hero, solid white once the page scrolls (and on every other page). */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const solid = pathname !== "/" || scrolled;
  return (
    <header
      data-solid={solid ? "" : undefined}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        solid ? "bg-[rgb(6_17_38/0.82)] shadow-[0_1px_0_rgb(255_255_255/0.06),0_10px_30px_-20px_rgb(0_0_0/0.6)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
