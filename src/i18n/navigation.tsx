import { createNavigation } from "next-intl/navigation";
import { forwardRef, type ComponentProps, type ElementRef } from "react";
import { routing } from "./routing";

const nav = createNavigation(routing);

/** Locale-aware redirect, usePathname, useRouter and getPathname for the customer site. */
export const { redirect, usePathname, useRouter, getPathname } = nav;

/**
 * Locale-aware Link with prefetching off by default. Pages are rendered per request on Workers,
 * so prefetching every visible link mostly downloads and runs code the visitor never uses —
 * costly on mobile data and for responsiveness. Pass prefetch explicitly to opt back in.
 */
export const Link = forwardRef<ElementRef<typeof nav.Link>, ComponentProps<typeof nav.Link>>(function Link({ prefetch = false, ...props }, ref) {
  return <nav.Link ref={ref} prefetch={prefetch} {...props} />;
});
