import { cn } from "@/lib/cn";
import "./virtual.css";

/**
 * A 360° horizon strip that drifts endlessly sideways (two copies of the same seamless strip).
 * Plain images and CSS only — no viewer script — so it is cheap enough for the homepage.
 */
export function PanoramaBand({ src, className, eager = false, duration = 150 }: { src: string; className?: string; eager?: boolean; duration?: number }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="vt-band flex h-full w-max" style={{ ["--vt-drift-duration" as string]: `${duration}s` }}>
        {[0, 1].map((i) => (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized strip, no optimizer
          <img
            key={i}
            src={src}
            alt=""
            width={3600}
            height={600}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-auto max-w-none select-none"
          />
        ))}
      </div>
    </div>
  );
}
