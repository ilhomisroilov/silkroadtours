"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { GirihPattern, GirihRosette } from "@/components/ornament";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  href?: string;
  caption?: string;
  number?: number;
}

const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false });

/**
 * Leaflet + OpenStreetMap, downloaded only when the map scrolls near the viewport,
 * so it never slows down the first paint. The surrounding page always lists the same
 * places as links, so the map is supplementary for screen-reader and keyboard users.
 */
export function LazyMap({
  points,
  route = false,
  label,
  loadingLabel,
  attribution,
  className,
}: {
  points: MapPoint[];
  route?: boolean;
  label: string;
  loadingLabel: string;
  attribution: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} role="region" aria-label={label} className={cn("relative isolate overflow-hidden rounded-[var(--radius-card)] bg-sand", className)}>
      {visible ? (
        <LeafletMap points={points} route={route} attribution={attribution} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <GirihPattern className="absolute inset-0" tone="lapis" opacity={0.15} />
          <div className="relative flex flex-col items-center gap-2 text-ink-muted">
            <GirihRosette size={44} tone="lapis" />
            <span className="text-sm">{loadingLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
