"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { GirihPattern, GirihRosette } from "@/components/ornament";
import { cn } from "@/lib/cn";
import type { AtlasMapProps } from "./atlas-map";

const AtlasMap = dynamic(() => import("./atlas-map"), { ssr: false });

/**
 * Loads Leaflet only when the map is near the viewport (or at once with `eager`), showing a branded placeholder meanwhile.
 * The page always lists the same items as text, so the map is supplementary for keyboard and screen-reader users.
 */
export function LazyAtlasMap({ label, loadingLabel, className, eager = false, ...props }: AtlasMapProps & { label: string; loadingLabel: string; className?: string; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return (
    <div ref={ref} role="region" aria-label={label} className={cn("relative isolate overflow-hidden bg-sand", className)}>
      {visible ? (
        <AtlasMap {...props} />
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
