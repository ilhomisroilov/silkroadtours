"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { addTripItem, hasTripItem, onTripChange, removeTripItem, type TripItem } from "@/lib/trip-store";

/**
 * Toggles one item in the visitor's trip (src/lib/trip-store). Reusable anywhere:
 *   <AddToTripButton {...item} />   — the page's client messages must include the "tripButton" namespace.
 * `compact` shows only the icon (the accessible name still says what it does).
 */
export function AddToTripButton({
  className,
  size = "md",
  tone = "light",
  compact = false,
  onToggle,
  ...item
}: TripItem & {
  className?: string;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  compact?: boolean;
  onToggle?: (added: boolean) => void;
}) {
  const t = useTranslations("tripButton");
  const [added, setAdded] = useState(false);
  useEffect(() => {
    setAdded(hasTripItem(item.id));
    return onTripChange((s) => setAdded(s.items.some((i) => i.id === item.id)));
  }, [item.id]);

  const label = (key: "add" | "added" | "addLabel" | "removeLabel") => (t.has(key) ? t(key, { title: item.title }) : item.title);

  const toggle = () => {
    if (added) removeTripItem(item.id);
    else {
      const { id, kind, title, refSlug, destinationSlug, priceUsd, priceUnit, lat, lng, day, meta, image } = item;
      addTripItem({ id, kind, title, refSlug, destinationSlug, priceUsd, priceUnit, lat, lng, day, meta, image });
    }
    setAdded(!added);
    onToggle?.(!added);
  };

  const dark = tone === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={added}
      aria-label={compact ? (added ? label("removeLabel") : label("addLabel")) : undefined}
      title={compact ? (added ? label("removeLabel") : label("addLabel")) : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold transition-colors",
        size === "sm" ? "min-h-10 text-sm" : "min-h-11 text-[0.95rem]",
        compact ? (size === "sm" ? "size-10" : "size-11") : size === "sm" ? "px-3.5" : "px-5",
        added
          ? dark
            ? "bg-saffron text-lapis-deep hover:bg-saffron-soft"
            : "bg-success text-white hover:bg-success/90"
          : dark
            ? "bg-white/12 text-white ring-1 ring-white/40 hover:bg-white/20"
            : "bg-lapis text-white hover:bg-cobalt",
        className,
      )}
    >
      {added ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
      {!compact && <span>{added ? label("added") : label("add")}</span>}
      {!compact && <span className="sr-only">: {item.title}</span>}
    </button>
  );
}
