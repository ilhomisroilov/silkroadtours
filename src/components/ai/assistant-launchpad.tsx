"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { openAssistant } from "./assistant-widget";

/** Buttons that open the floating assistant, optionally sending a question straight away. */
export function AssistantLaunchpad({ start, examples }: { start: string; examples: string[] }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => openAssistant()}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lapis px-6 font-bold text-white shadow-[0_10px_24px_-12px_rgb(23_61_102/0.8)] hover:bg-cobalt"
      >
        <MessageCircle aria-hidden="true" className="size-5" /> {start}
      </button>
      <ul className="grid gap-2 sm:grid-cols-2">
        {examples.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => openAssistant(q, true)}
              className="inline-flex min-h-12 w-full items-center gap-2 rounded-2xl bg-white px-4 py-2 text-left text-sm font-semibold text-lapis shadow-card transition hover:-translate-y-0.5 hover:bg-sky"
            >
              <Sparkles aria-hidden="true" className="size-4 shrink-0 text-cobalt" /> {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
