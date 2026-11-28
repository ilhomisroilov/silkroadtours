import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Gulistan Travel logo: blue pin with Uzbek architecture, a golden arc and a plane (emblem kept from the
 * previous brand; wordmark built by scripts/brand/make-logo.py until final artwork arrives).
 * "light" is for light backgrounds (header); "dark" is the white-lettered lockup with the slogan (footer).
 * Source artwork: public/brand/ (transparent background).
 */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return tone === "dark" ? (
    <Image
      src="/brand/gulistan-travel-logo-light.webp"
      alt="Gulistan Travel — Your journey. One platform."
      width={695}
      height={276}
      unoptimized
      className={cn("h-auto w-[15rem] max-w-full", className)}
    />
  ) : (
    <Image
      src="/brand/gulistan-travel-header-light.webp"
      alt="Gulistan Travel"
      width={479}
      height={168}
      priority
      unoptimized
      className={cn("h-12 w-auto sm:h-14", className)}
    />
  );
}
