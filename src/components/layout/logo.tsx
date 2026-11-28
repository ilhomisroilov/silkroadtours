import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * Brand logo (blue pin with Uzbek architecture, a golden arc and a plane) for the deployment's brand
 * (src/lib/brand.ts). "light" is the header lockup; "dark" is the lockup with the slogan (footer).
 * Source artwork: public/brand/ (transparent background).
 */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { header, footer, stacked } = BRAND.logo;
  // The stacked artwork has navy lettering: a soft light halo keeps it readable on the dark glass header.
  const halo = stacked ? "[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.95))_drop-shadow(0_0_6px_rgba(255,255,255,0.45))]" : "";
  return tone === "dark" ? (
    <Image
      src={footer.src}
      alt={`${BRAND.name} — ${BRAND.slogan}`}
      width={footer.width}
      height={footer.height}
      unoptimized
      className={cn(stacked ? "h-auto w-[11rem] max-w-full" : "h-auto w-[15rem] max-w-full", halo, className)}
    />
  ) : (
    <Image
      src={header.src}
      alt={BRAND.name}
      width={header.width}
      height={header.height}
      priority
      unoptimized
      className={cn(stacked ? "h-[3.75rem] w-auto sm:h-[4.25rem]" : "h-12 w-auto sm:h-14", halo, className)}
    />
  );
}
