"use client";

import { CalendarRange, Scale, SendHorizontal, Wallet } from "lucide-react";
import { useState } from "react";
import { openAssistant } from "@/components/ai/assistant-widget";
import { RobotIllustration } from "@/components/ai/robot";

type Labels = {
  title: string;
  text: string;
  placeholder: string;
  send: string;
  chips: { label: string; question: string }[];
};

const ICONS = [CalendarRange, Wallet, Scale];

/** Home-page entry to the real assistant: chips and the input send the question straight into the chat. */
export function HomeAiCard({ labels }: { labels: Labels }) {
  const [q, setQ] = useState("");
  return (
    <section
      aria-labelledby="home-ai-title"
      className="bg-ai-soft relative flex h-full flex-col overflow-hidden rounded-[1.5rem] p-6 shadow-card ring-1 ring-white/60 sm:p-7"
    >
      <svg className="pointer-events-none absolute right-5 top-5 h-8 w-8 text-cobalt/70" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
      </svg>
      <div className="flex items-center gap-4">
        <RobotIllustration className="w-24 shrink-0 drop-shadow-[0_12px_18px_rgba(36,91,168,0.25)] motion-safe:animate-[float_5s_ease-in-out_infinite] sm:w-28" />
        <div>
          <h2 id="home-ai-title" className="text-2xl leading-tight text-lapis sm:text-[1.7rem]">
            {labels.title}
          </h2>
          <p className="mt-2 text-[0.95rem] text-ink/80">{labels.text}</p>
        </div>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {labels.chips.map((c, i) => {
          const Icon = ICONS[i] ?? CalendarRange;
          return (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => openAssistant(c.question, true)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[0.82rem] font-semibold text-lapis shadow-[0_2px_8px_-4px_rgb(23_61_102/0.35)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <Icon aria-hidden="true" className="size-4 text-cobalt" />
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-5 flex items-center rounded-full bg-white p-1.5 shadow-[0_6px_18px_-10px_rgb(23_61_102/0.5)]"
        onSubmit={(e) => {
          e.preventDefault();
          const text = q.trim();
          openAssistant(text || undefined, Boolean(text));
          setQ("");
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{labels.placeholder}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={500}
            placeholder={labels.placeholder}
            className="h-11 w-full bg-transparent px-4 text-[0.95rem] text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </label>
        <button
          type="submit"
          aria-label={labels.send}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-cobalt text-white transition hover:bg-lapis"
        >
          <SendHorizontal aria-hidden="true" className="size-5" />
        </button>
      </form>
    </section>
  );
}
