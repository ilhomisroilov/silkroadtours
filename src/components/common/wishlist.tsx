"use client";

import { Heart } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const KEY = "nt-wishlist";
const EVENT = "nt:wishlist";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Saved tour slugs, kept on this device only (no account needed). */
export function useWishlist() {
  const [list, setList] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setList(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = useCallback((slug: string) => {
    const current = read();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug].slice(-40);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory for this page */
    }
    setList(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { list, ready, toggle, has: (slug: string) => list.includes(slug) };
}

export function WishlistButton({
  slug,
  addLabel,
  removeLabel,
  className,
}: {
  slug: string;
  addLabel: string;
  removeLabel: string;
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(slug);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={saved}
      aria-label={saved ? removeLabel : addLabel}
      title={saved ? removeLabel : addLabel}
      className={cn(
        "relative z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-lapis shadow-card backdrop-blur transition hover:scale-105 hover:bg-white",
        className,
      )}
    >
      <Heart aria-hidden="true" className={cn("size-5 transition-colors", saved && "fill-[#e0565b] text-[#e0565b]")} />
    </button>
  );
}

export function WishlistLink({ label, className }: { label: string; className?: string }) {
  const { list } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={list.length ? `${label} (${list.length})` : label}
      title={label}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full bg-white/80 text-lapis shadow-[0_1px_0_rgb(23_61_102/0.06)] ring-1 ring-lapis/10 hover:bg-white",
        className,
      )}
    >
      <Heart aria-hidden="true" className={cn("size-5", list.length > 0 && "fill-[#e0565b] text-[#e0565b]")} />
      {list.length > 0 && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-saffron px-1 text-[0.7rem] font-bold leading-5 text-lapis-deep">
          {list.length}
        </span>
      )}
    </Link>
  );
}

/** Shows only the server-rendered cards whose slug is in the wishlist. */
export function WishlistGrid({ items, empty }: { items: { slug: string; node: ReactNode }[]; empty: ReactNode }) {
  const { list, ready } = useWishlist();
  if (!ready) return <div className="h-40" aria-busy="true" />;
  const shown = items.filter((i) => list.includes(i.slug));
  if (shown.length === 0) return <>{empty}</>;
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((i) => (
        <li key={i.slug}>{i.node}</li>
      ))}
    </ul>
  );
}

/** Link to the comparison page pre-filled with the saved tours. */
export function WishlistCompareLink({ label }: { label: string }) {
  const { list } = useWishlist();
  if (list.length < 2) return null;
  return (
    <Link
      href={{ pathname: "/compare", query: { tours: list.slice(0, 3).join(",") } }}
      className="inline-flex min-h-11 items-center rounded-full bg-lapis px-5 text-sm font-bold text-white hover:bg-cobalt"
    >
      {label}
    </Link>
  );
}
