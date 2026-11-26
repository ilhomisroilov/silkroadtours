"use client";

import { Orbit, Route, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { uzDeep } from "@/lib/uz-alphabet";

const TEXT = {
  en: {
    title: "Before you go…",
    lead: "Your Uzbekistan trip is one step away. Pick where to start:",
    close: "Close",
    tiles: [
      { href: "/ai-guide", title: "Plan with the AI guide", text: "A day-by-day plan from our catalogue in a minute." },
      { href: "/virtual-tours", title: "Take a 360° walk", text: "Step into Tashkent and the Chatkal mountains now." },
      { href: "/trip-builder", title: "Build your trip", text: "Hotels, trains and sights with a live budget." },
    ],
  },
  uz: {
    title: "Ketishdan oldin…",
    lead: "Oʻzbekiston sayohatingizga bir qadam qoldi. Qayerdan boshlaysiz?",
    close: "Yopish",
    tiles: [
      { href: "/ai-guide", title: "AI gid bilan reja tuzing", text: "Bir daqiqada katalogimizdan kunma-kun reja." },
      { href: "/virtual-tours", title: "360° sayr qiling", text: "Toshkent va Chotqol togʻlariga hozir kiring." },
      { href: "/trip-builder", title: "Sayohatingizni tuzing", text: "Mehmonxona, poyezd va joylar, byudjet bilan." },
    ],
  },
  ru: {
    title: "Прежде чем уйти…",
    lead: "До поездки в Узбекистан один шаг. С чего начнём?",
    close: "Закрыть",
    tiles: [
      { href: "/ai-guide", title: "План с ИИ-гидом", text: "Маршрут по дням из нашего каталога за минуту." },
      { href: "/virtual-tours", title: "Прогулка 360°", text: "Ташкент и горы Чаткала прямо сейчас." },
      { href: "/trip-builder", title: "Соберите поездку", text: "Отели, поезда и места с расчётом бюджета." },
    ],
  },
} as const;
const ICONS = [Sparkles, Orbit, Route];
const KEY = "nt.keep-exploring.v1";

/** A one-per-visit invitation to keep exploring, shown when the pointer heads for the browser bar. */
export function KeepExploring({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = locale === "uz" ? uzDeep(TEXT.uz) : TEXT[locale];

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {}
    if (seen || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const armedAt = Date.now() + 8000;
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 8 || Date.now() < armedAt) return;
      setOpen(true);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      document.removeEventListener("mouseout", onOut);
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="keep-title">
      <button type="button" aria-label={t.close} className="absolute inset-0 bg-[rgb(4_18_32/0.55)] backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="animate-fade-up relative w-full max-w-3xl overflow-hidden rounded-[1.5rem] bg-white p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(21_195_210/0.35),transparent_65%)]" />
        <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t.close} className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X aria-hidden="true" className="size-5" />
        </button>
        <h2 id="keep-title" className="font-[Georgia,'Times_New_Roman',serif] text-3xl font-normal text-white sm:text-4xl">{t.title}</h2>
        <p className="mt-2 text-white/80">{t.lead}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {t.tiles.map((tile, i) => {
            const Icon = ICONS[i]!;
            return (
              <li key={tile.href}>
                <Link href={tile.href} onClick={() => setOpen(false)} className="group flex h-full flex-col gap-3 rounded-[1.1rem] bg-white/10 p-4 ring-1 ring-white/15 hover:bg-white/15">
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#176bcb] text-white shadow-[0_8px_24px_-8px_rgb(23_107_203/0.8)]">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="font-bold text-white">{tile.title}</span>
                  <span className="text-sm text-white/75">{tile.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
