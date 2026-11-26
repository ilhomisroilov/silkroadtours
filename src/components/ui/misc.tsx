import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { GirihRosette, SuzaniMedallion } from "@/components/ornament";

export function Badge({
  className,
  tone = "sand",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "sand" | "lapis" | "turquoise" | "terracotta" | "saffron" | "pomegranate" | "success" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "sand" && "bg-sand text-ink",
        tone === "lapis" && "bg-lapis text-white",
        tone === "turquoise" && "bg-turquoise-ink text-white",
        tone === "terracotta" && "bg-terracotta text-white",
        tone === "saffron" && "bg-saffron text-ink",
        tone === "pomegranate" && "bg-pomegranate text-white",
        tone === "success" && "bg-success text-white",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/** Loading indicator: a slowly turning girih rosette (static when reduced motion is requested). */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-3 text-ink-muted", className)}>
      <GirihRosette size={48} tone="lapis" className="motion-safe:animate-spin-slow" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line bg-sand-soft/50 px-6 py-12 text-center">
      <SuzaniMedallion size={96} />
      <h2 className="text-2xl text-lapis-deep">{title}</h2>
      {children && <div className="max-w-md text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] bg-white shadow-card", className)} {...props} />;
}
