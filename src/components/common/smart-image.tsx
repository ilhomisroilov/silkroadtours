import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { imageExists } from "@/lib/images";
import { DomeSilhouette, GirihPattern, GirihRosette } from "@/components/ornament";

/**
 * Branded placeholder shown whenever a photo has not been uploaded yet:
 * an ornament composition with the place name. Never a stock photo.
 */
export function BrandedFallback({
  label,
  variant = "lapis",
  className,
  showLabel = true,
  compact = false,
}: {
  label: string;
  variant?: "lapis" | "sand";
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const dark = variant === "lapis";
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center overflow-hidden",
        dark ? "bg-lapis-deep text-ivory" : "bg-sand text-lapis-deep",
        className,
      )}
    >
      <GirihPattern className="absolute inset-0" tone={dark ? "saffron" : "lapis"} opacity={dark ? 0.35 : 0.18} tile={compact ? 56 : 84} />
      <div
        className={cn(
          "absolute inset-x-[18%] bottom-0 top-[14%] rounded-t-[50%_32%]",
          dark ? "bg-lapis/70 ring-1 ring-saffron/50" : "bg-ivory/55 ring-1 ring-lapis/25",
        )}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        {compact ? (
          <GirihRosette size={36} tone={dark ? "saffron" : "lapis"} />
        ) : (
          <DomeSilhouette className="h-auto w-[min(34%,7rem)]" />
        )}
        {showLabel && (
          <span
            aria-hidden="true"
            className={cn("font-display font-semibold leading-tight", compact ? "text-lg" : "text-2xl", dark ? "text-ivory" : "text-lapis-deep")}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function SmartImage({
  src,
  alt,
  label,
  className,
  imgClassName,
  priority = false,
  variant = "lapis",
  compact,
  sizes,
  style,
  width = 1600,
  height = 1067,
}: {
  src: string | null | undefined;
  alt: string;
  /** Text for the branded fallback (usually the place or tour name). */
  label: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  variant?: "lapis" | "sand";
  compact?: boolean;
  sizes?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
}) {
  if (!imageExists(src)) {
    return (
      <div className={cn("h-full w-full", className)} style={style}>
        <BrandedFallback label={label} variant={variant} compact={compact} />
      </div>
    );
  }
  return (
    <div className={cn("h-full w-full", className)} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- images are pre-sized; no optimizer on Workers */}
      <img
        src={src!}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
