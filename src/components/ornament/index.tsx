// Original SVG ornament library. Decorative only: every SVG is aria-hidden.
// Use with restraint — dividers, hero overlays, card frames, loading and empty states.
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { khatamPath, polygonPath, starPolygonPath } from "./geometry";

type Tone = "saffron" | "lapis" | "turquoise" | "ivory" | "pomegranate" | "ink";
const TONE: Record<Tone, string> = {
  saffron: "var(--color-saffron)",
  lapis: "var(--color-lapis)",
  turquoise: "var(--color-turquoise)",
  ivory: "var(--color-ivory)",
  pomegranate: "var(--color-pomegranate)",
  ink: "var(--color-ink)",
};

interface BaseProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Seamless girih (8-point star) lattice. Fills its box; use absolutely positioned over a band or hero.
 * Rendered as a CSS background of a static, cached SVG tile (public/ornament/pattern-<tone>.svg).
 */
export function GirihPattern({
  className,
  style,
  tone = "saffron",
  tile = 96,
  opacity = 0.35,
}: BaseProps & { tone?: Tone; tile?: number; strokeWidth?: number; opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      style={{ backgroundImage: `url(/ornament/pattern-${tone}.svg)`, backgroundSize: `${tile}px ${tile}px`, opacity, ...style }}
    />
  );
}

/** Islimi vine-scroll border, repeated horizontally (static SVG tile). */
export function IslimiBorder({ className, tone = "saffron", height = 24 }: BaseProps & { tone?: "saffron" | "lapis"; height?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn("block w-full bg-repeat-x", className)}
      style={{ height, backgroundImage: `url(/ornament/islimi-${tone}.svg)`, backgroundSize: `${(120 * height) / 32}px ${height}px` }}
    />
  );
}

/** Ikat stripe divider: feathered-edge diamonds in alternating colours (static SVG tile). */
export function IkatDivider({ className, height = 18 }: BaseProps & { height?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn("block w-full bg-repeat-x", className)}
      style={{ height, backgroundImage: "url(/ornament/ikat.svg)", backgroundSize: `${(44 * height) / 18}px ${height}px` }}
    />
  );
}

/** Suzani medallion: pomegranate petals, leaf ring and dotted borders (static SVG). */
export function SuzaniMedallion({ className, size = 160, palette = "warm" }: BaseProps & { size?: number; palette?: "warm" | "night" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/ornament/suzani-${palette}.svg`} width={size} height={size} alt="" aria-hidden="true" loading="lazy" decoding="async" className={className} />
  );
}

/** Ten-point girih rosette ({10/3} star in a decagon) — used as an emblem and loading spinner. */
export function GirihRosette({
  className,
  size = 64,
  tone = "saffron",
  strokeWidth = 1.6,
}: BaseProps & { size?: number; tone?: Tone; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100" width={size} height={size} className={className}>
      <g fill="none" stroke={TONE[tone]} strokeWidth={strokeWidth} strokeLinejoin="round">
        <circle cx="50" cy="50" r="47" />
        <path d={polygonPath(50, 50, 44, 10, 18)} />
        <path d={starPolygonPath(50, 50, 44, 10, 3, 0)} />
        <path d={starPolygonPath(50, 50, 20, 10, 4, 18)} />
      </g>
    </svg>
  );
}

/** Ribbed turquoise dome silhouette (drum, ribs, finial) — static SVG. */
export function DomeSilhouette({ className }: BaseProps & { tone?: Tone }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/ornament/dome.svg" width={120} height={150} alt="" aria-hidden="true" decoding="async" className={className} />
  );
}

/** Thin saffron arch frame drawn over an arch-masked image. */
export function ArchFrame({ className, tone = "saffron", inset = 0 }: BaseProps & { tone?: Tone; inset?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <path
        d="M0 140V52C0 28 22 9 50 0c28 9 50 28 50 52v88z"
        transform={inset ? `translate(${inset} ${inset * 1.4}) scale(${(100 - inset * 2) / 100} ${(140 - inset * 1.4) / 140})` : undefined}
        fill="none"
        stroke={TONE[tone]}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A centred ornament rule: line — rosette — line. Section divider on light backgrounds. */
export function OrnamentRule({ className, tone = "saffron" }: BaseProps & { tone?: Tone }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${TONE[tone]})` }} />
      <svg viewBox="0 0 40 40" width="22" height="22">
        <path d={khatamPath(20, 20, 18)} fill="none" stroke={TONE[tone]} strokeWidth="1.6" />
        <path d={polygonPath(20, 20, 6, 8, 22.5)} fill={TONE[tone]} />
      </svg>
      <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${TONE[tone]})` }} />
    </div>
  );
}
