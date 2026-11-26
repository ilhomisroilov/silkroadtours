import { cn } from "@/lib/cn";

/** National Tours mark: two peaks, the left slope in gold and the right in blue. */
export function LogoMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const stroke = tone === "dark" ? "#ffffff" : "#173d66";
  return (
    <svg viewBox="0 0 64 40" className={cn("h-9 w-auto", className)} aria-hidden="true">
      <path d="M20 10 L29 36 H10 Z" fill="#d9a441" />
      <path d="M41 6 L52 36 H35 Z" fill="#245ba8" opacity="0.9" />
      <path
        d="M3 36 L20 10 L29 22 L41 6 L61 36"
        fill="none"
        stroke={stroke}
        strokeWidth="4.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} />
      <span
        className={cn(
          "font-display text-[1.32rem] font-extrabold leading-[0.95] tracking-[-0.02em]",
          tone === "dark" ? "text-white" : "text-lapis",
        )}
      >
        National
        <br />
        Tours
      </span>
    </span>
  );
}
