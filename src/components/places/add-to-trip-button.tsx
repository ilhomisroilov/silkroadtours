"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { addTripItem, hasTripItem, onTripChange, removeTripItem, type TripItem } from "@/lib/trip-store";

/**
 * "Add to trip" toggle for hotels, restaurants and transport. The trip lives in the visitor's browser
 * (trip-store) and is shared with the Trip Constructor, the travel map and the AI guide.
 */
export function AddToTripButton({
  item,
  className,
  tone = "solid",
  size = "md",
  showViewLink = true,
}: {
  item: TripItem;
  className?: string;
  tone?: "solid" | "outline" | "light";
  size?: "sm" | "md";
  showViewLink?: boolean;
}) {
  const t = useTranslations("placeCommon");
  const [inTrip, setInTrip] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    setInTrip(hasTripItem(item.id));
    return onTripChange((s) => setInTrip(s.items.some((i) => i.id === item.id)));
  }, [item.id]);

  const toggle = () => {
    if (inTrip) {
      removeTripItem(item.id);
      setAnnounce(t("removedAnnounce", { title: item.title }));
    } else {
      addTripItem(item);
      setAnnounce(t("addedAnnounce", { title: item.title }));
    }
  };

  const base = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors",
    size === "sm" ? "min-h-10 px-4 text-sm" : "min-h-12 px-5 text-[0.95rem]",
  );
  const look = inTrip
    ? "bg-success/10 text-success ring-1 ring-success/40 hover:bg-success/15"
    : tone === "solid"
      ? "bg-lapis-deep text-white hover:bg-cobalt"
      : tone === "light"
        ? "bg-white text-lapis-deep hover:bg-saffron-soft"
        : "border border-lapis-deep text-lapis-deep hover:bg-lapis-deep hover:text-white";

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <button type="button" onClick={toggle} aria-pressed={inTrip} className={cn(base, look)} data-testid="add-to-trip">
        {inTrip ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
        {inTrip ? t("inTrip") : t("addToTrip")}
      </button>
      {inTrip && showViewLink && (
        <Link href="/trip-builder" className="text-sm font-semibold text-cobalt underline underline-offset-4 hover:text-lapis">
          {t("viewTrip")}
        </Link>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </span>
  );
}
