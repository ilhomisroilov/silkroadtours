"use client";

import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

export type Testimonial = { id: number; author: string; country: string | null; rating: number; body: string; tour?: string | null };

/** Rotating card of published reviews. */
export function Testimonials({ items, labels }: { items: Testimonial[]; labels: { prev: string; next: string; from: string; title: string } }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => window.clearInterval(id);
  }, [paused, items.length]);
  const r = items[i]!;
  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      className="flex h-full flex-col rounded-[1.5rem] bg-white p-6 shadow-card"
    >
      <h2 className="sr-only">{labels.title}</h2>
      <Quote aria-hidden="true" className="size-7 fill-lapis-mist text-lapis-mist" />
      <blockquote key={r.id} className="animate-fade-up mt-2 flex-1 text-[1.02rem] font-medium leading-relaxed text-ink" aria-live="polite">
        <p className="line-clamp-6">{r.body}</p>
      </blockquote>
      <div className="mt-5 flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cobalt to-lapis text-lg font-bold text-white">
          {r.author.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-ink">{r.author}</p>
          {r.country && <p className="truncate text-sm text-ink-muted">{labels.from.replace("{country}", r.country)}</p>}
          <p className="mt-0.5 flex gap-0.5" aria-label={`${r.rating}/5`}>
            {Array.from({ length: 5 }, (_, k) => (
              <Star key={k} aria-hidden="true" className={`size-4 ${k < r.rating ? "fill-saffron text-saffron" : "text-line"}`} />
            ))}
          </p>
        </div>
      </div>
      {items.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => setI((x) => (x - 1 + items.length) % items.length)} aria-label={labels.prev} className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-line hover:bg-sky">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <p className="flex gap-1.5" aria-hidden="true">
            {items.map((x, k) => (
              <span key={x.id} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-cobalt" : "w-1.5 bg-line"}`} />
            ))}
          </p>
          <button type="button" onClick={() => setI((x) => (x + 1) % items.length)} aria-label={labels.next} className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-line hover:bg-sky">
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}
    </section>
  );
}
