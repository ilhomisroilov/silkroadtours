import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * National Tours logo: blue pin with Uzbek architecture, a golden arc and a plane.
 * "light" is for light backgrounds (header); "dark" is the white-lettered lockup with the slogan (footer).
 * Source artwork: public/brand/ (transparent background).
 */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return tone === "dark" ? (
    <Image
      src="/brand/national-tours-logo-light.webp"
      alt="National Tours — Your journey. One platform."
      width={720}
      height={276}
      unoptimized
      className={cn("h-auto w-[15rem] max-w-full", className)}
    />
  ) : (
    <Image
      src="/brand/national-tours-header-light.webp"
      alt="National Tours"
      width={439}
      height={168}
      priority
      unoptimized
      className={cn("h-12 w-auto sm:h-14", className)}
    />
  );
}
