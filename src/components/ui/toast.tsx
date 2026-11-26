"use client";

// shadcn/ui Toast (Radix Toast) with a tiny global store: call toast({ title, tone }) anywhere.
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: { title: string; description?: string; tone?: Tone }) {
  items = [...items, { id: nextId++, tone: t.tone ?? "info", title: t.title, description: t.description }];
  emit();
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const EMPTY: ToastItem[] = [];

export function Toaster({ closeLabel, label }: { closeLabel: string; label: string }) {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000} label={label}>
      {list.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          type={t.tone === "error" ? "foreground" : "background"}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "relative flex w-full items-start gap-3 rounded-sm border-l-4 bg-ivory p-4 pr-12 shadow-lift",
            t.tone === "success" && "border-success",
            t.tone === "error" && "border-danger",
            t.tone === "info" && "border-cobalt",
          )}
        >
          <div>
            <ToastPrimitive.Title className="font-semibold text-ink">{t.title}</ToastPrimitive.Title>
            {t.description && <ToastPrimitive.Description className="mt-1 text-sm text-ink-muted">{t.description}</ToastPrimitive.Description>}
          </div>
          <ToastPrimitive.Close className="absolute right-2 top-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-sand-soft">
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">{closeLabel}</span>
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,24rem)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
