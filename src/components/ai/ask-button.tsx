"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { openAssistant } from "./assistant-widget";

/** Opens the assistant and sends a ready-made question about the current page. */
export function AskAssistantButton({ label, question, className, send = true }: { label: string; question: string; className?: string; send?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openAssistant(question, send)}
      className={cn("inline-flex min-h-11 items-center gap-2 rounded-full bg-lapis px-5 text-sm font-bold text-white transition hover:bg-[#1259ad]", className)}
    >
      <Sparkles aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
