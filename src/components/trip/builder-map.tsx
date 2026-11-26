"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { dayColor, itemHref, orderedItems } from "@/lib/trip-helpers";
import type { TripState } from "@/lib/trip-store";
import { AddToTripButton } from "./add-to-trip-button";
import type { AtlasMarker, AtlasRoute } from "./atlas-map";
import { LazyAtlasMap } from "./lazy-atlas-map";

/** All trip items on one map, coloured by day, with each day's route in order. */
export function BuilderMap({ trip, dayCount }: { trip: TripState; dayCount: number }) {
  const t = useTranslations("tripBuilder.map");
  const tk = useTranslations("tripBuilder.catalogue.kind");
  const dayOf = (d?: number) => (d && d <= dayCount ? d : undefined);
  const located = useMemo(() => orderedItems(trip.items).filter((i) => typeof i.lat === "number" && typeof i.lng === "number"), [trip.items]);
  const markers: AtlasMarker[] = located.map((i) => {
    const day = dayOf(i.day);
    const href = itemHref(i);
    return {
      id: i.id,
      lat: i.lat!,
      lng: i.lng!,
      color: dayColor(day),
      label: `${i.title}${day ? ` · ${t("dayN", { day })}` : ""}`,
      badge: day ? String(day) : undefined,
      glyph: i.kind,
      popup: (
        <div className="space-y-1.5 font-sans [&_p]:my-0!">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {tk(i.kind)}
            {day ? ` · ${t("dayN", { day })}` : ` · ${t("unscheduled")}`}
          </p>
          <p className="text-sm font-extrabold text-lapis">{i.title}</p>
          {i.meta && <p className="text-xs text-ink-muted">{i.meta}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <AddToTripButton {...i} size="sm" />
            {href && (
              <Link href={href} className="text-sm font-semibold text-cobalt underline">
                {t("details")}
              </Link>
            )}
          </div>
        </div>
      ),
    };
  });
  const routes: AtlasRoute[] = [];
  const days = [...new Set(located.map((i) => dayOf(i.day)).filter((d): d is number => !!d))].sort((a, b) => a - b);
  let prevEnd: [number, number] | null = null;
  for (const d of days) {
    const pts = located.filter((i) => dayOf(i.day) === d).map((i) => [i.lat!, i.lng!] as [number, number]);
    if (prevEnd && pts[0]) routes.push({ id: `link-${d}`, positions: [prevEnd, pts[0]], color: "#8a94a6", dashed: true });
    routes.push({ id: `day-${d}`, positions: pts, color: dayColor(d) });
    prevEnd = pts.at(-1) ?? prevEnd;
  }
  const fitKey = located.map((i) => i.id).join("|");

  return (
    <section aria-labelledby="tb-map" className="card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-3 sm:p-6 sm:pb-4">
        <div>
          <p className="eyebrow text-cobalt">{t("eyebrow")}</p>
          <h2 id="tb-map" className="mt-1.5 text-2xl text-lapis">
            {t("title")}
          </h2>
        </div>
        {days.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("legend")}>
            {days.map((d) => (
              <li key={d} className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-2.5 py-1 text-xs font-bold text-ink">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: dayColor(d) }} />
                {t("dayN", { day: d })}
              </li>
            ))}
          </ul>
        )}
      </div>
      {markers.length === 0 ? (
        <p className="mx-5 mb-5 rounded-2xl bg-sand-soft p-6 text-center text-sm text-ink-muted sm:mx-6 sm:mb-6">{t("empty")}</p>
      ) : (
        <LazyAtlasMap
          label={t("label")}
          loadingLabel={t("loading")}
          attribution={t("attribution")}
          markers={markers}
          routes={routes}
          fitKey={fitKey}
          scrollWheelZoom={false}
          className="h-[22rem] sm:h-[26rem]"
        />
      )}
    </section>
  );
}
