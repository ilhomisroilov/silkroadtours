"use client";

// Motion primitives (Framer Motion). LazyMotion + `m` keeps the runtime small, MotionConfig
// honours prefers-reduced-motion, and only transform/opacity are animated (no layout shift).
import { LazyMotion, m, MotionConfig, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/**
 * Slow fade-and-rise when the block scrolls into view. Content is visible in the server HTML
 * (good for LCP, crawlers and no-JS); only blocks that start below the fold are hidden after
 * hydration and then revealed, so nothing on the first screen ever flickers.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (reduce || !el || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);
  const Comp = as === "section" ? m.section : as === "li" ? m.li : m.div;
  return (
    <Comp
      ref={ref as never}
      className={className}
      initial={false}
      animate={state === "hidden" ? { opacity: 0, y: 18 } : { opacity: 1, y: 0 }}
      transition={state === "hidden" ? { duration: 0 } : { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}

/** Gentle parallax for the hero background layer only. */
export function HeroParallax({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  return (
    <div ref={ref} className={cn("absolute inset-0 overflow-hidden", className)}>
      <m.div style={{ y }} className="absolute inset-0 will-change-transform">
        {children}
      </m.div>
    </div>
  );
}
