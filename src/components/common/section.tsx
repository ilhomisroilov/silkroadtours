import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
  tone = "light",
  id,
  action,
  as: As = "h2",
}: {
  eyebrow?: string;
  title: string;
  text?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  id?: string;
  action?: ReactNode;
  as?: "h1" | "h2";
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center", action && "sm:flex-row sm:items-end sm:justify-between")}>
      <div className={cn("flex flex-col gap-3", align === "center" && "items-center")}>
        {eyebrow && (
          <p className={cn("text-sm font-bold uppercase tracking-[0.18em]", dark ? "text-saffron" : "text-saffron-ink")}>{eyebrow}</p>
        )}
        <As id={id} className={cn(As === "h1" ? "text-4xl" : "text-3xl", dark ? "text-ivory" : "text-lapis-deep")}>
          {title}
        </As>
        <DrawnRule tone={dark ? "var(--color-saffron)" : "var(--color-terracotta)"} />
        {text && <div className={cn("max-w-2xl text-lg", dark ? "text-sand" : "text-ink-muted")}>{text}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * Ornament rule under section titles that "draws" itself in as it scrolls into view.
 * Pure CSS (scroll-driven animation where supported, static elsewhere), so it costs no JavaScript.
 */
export function DrawnRule({ className, tone = "var(--color-saffron)" }: { className?: string; tone?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 16" className={cn("drawn-rule h-4 w-60", className)} fill="none">
      <path d="M2 8H96M144 8H238M104 8l8-6 8 6-8 6zM120 8l8-6 8 6-8 6z" stroke={tone} strokeWidth="1.6" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}
