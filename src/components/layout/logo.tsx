import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * Brand logo (blue pin with Uzbek architecture, a golden arc and a plane) for the deployment's brand
 * (src/lib/brand.ts). "light" is the header lockup; "dark" is the lockup with the slogan (footer).
 * Source artwork: public/brand/ (transparent background); Gulistan Travel's wordmark is built by
 * scripts/brand/make-logo.py until final artwork arrives.
 */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { header, footer } = BRAND.logo;
  return tone === "dark" ? (
    <Image
      src={footer.src}
      alt={`${BRAND.name} — ${BRAND.slogan}`}
      width={footer.width}
      height={footer.height}
      unoptimized
      className={cn("h-auto w-[15rem] max-w-full", className)}
    />
  ) : (
    <Image
      src={header.src}
      alt={BRAND.name}
      width={header.width}
      height={header.height}
      priority
      unoptimized
      className={cn("h-12 w-auto sm:h-14", className)}
    />
  );
}
