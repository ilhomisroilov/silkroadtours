"use client";

import { Camera, ChevronLeft, ChevronRight, Expand, Minimize, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { PhotoSlideView } from "./types";
import "./virtual.css";

const INTERVAL = 6500;

/**
 * Immersive photo walk for places without a full 360° panorama: full-bleed photos with a slow
 * pan-and-zoom, captions, arrows / swipe / keyboard, autoplay with pause, fullscreen and credits.
 */
export function PhotoTour({ slides, title }: { slides: PhotoSlideView[]; title: string }) {
  const t = useTranslations("virtualTours.photo");
  const shellRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const touchX = useRef<number | null>(null);
  const fullscreen = nativeFs || pseudoFs;
  const total = slides.length;
  const slide = slides[index]!;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(true);
  }, []);
  useEffect(() => {
    if (!playing || total < 2) return;
    const id = window.setTimeout(() => go(1), INTERVAL);
    return () => window.clearTimeout(id);
  }, [playing, index, go, total]);
  useEffect(() => {
    const onChange = () => setNativeFs(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!pseudoFs) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFs(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudoFs]);

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) return void (await document.exitFullscreen().catch(() => undefined));
    if (pseudoFs) return setPseudoFs(false);
    if (document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // fall back to the full-window layer
      }
    }
    setPseudoFs(true);
  }

  const ctrl =
    "inline-flex size-11 items-center justify-center rounded-full bg-lapis-night/70 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-lapis-night/90 [&_svg]:size-5";

  return (
    <div
      ref={shellRef}
      className={cn(
        "on-dark flex flex-col overflow-hidden bg-lapis-night text-white",
        fullscreen ? "fixed inset-0 z-[100] h-[100dvh] w-screen" : "relative rounded-[var(--radius-card)] shadow-lift",
      )}
    >
      <div
        role="region"
        aria-roledescription={t("roleDescription")}
        aria-label={title}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setPlaying(false);
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPlaying(false);
            go(-1);
          }
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 40) return;
          setPlaying(false);
          go(end < start ? 1 : -1);
        }}
        className={cn(
          "relative isolate w-full overflow-hidden focus-visible:outline-offset-[-3px]",
          fullscreen ? "min-h-0 flex-1" : "h-[62svh] min-h-[20rem] sm:h-[min(74vh,42rem)]",
        )}
      >
        {slides.map((s, i) => {
          const near = i === index || i === (index + 1) % total || i === (index - 1 + total) % total;
          if (!near) return null;
          return (
            <div
              key={s.image}
              aria-hidden={i !== index}
              className={cn("absolute inset-0 transition-opacity duration-1000", i === index ? "opacity-100" : "opacity-0")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local pre-sized photos */}
              <img
                key={i === index ? `${s.image}-${index}` : s.image}
                src={s.image}
                alt={i === index ? s.title : ""}
                width={1600}
                height={1067}
                decoding="async"
                className={cn("h-full w-full object-cover", i === index && (index % 2 ? "vt-kenburns-alt" : "vt-kenburns"))}
              />
            </div>
          );
        })}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-lapis-night/90 via-lapis-night/10 to-lapis-night/50" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
          <p className="flex items-center gap-2 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-saffron">
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-2 py-0.5 text-[0.7rem] tracking-normal text-lapis-deep">
              <Camera aria-hidden="true" className="size-3.5" /> {t("badge")}
            </span>
            {t("slideOf", { index: index + 1, total })}
          </p>
          <div className="flex shrink-0 gap-2" role="toolbar" aria-label={t("controls")}>
            <button
              type="button"
              className={ctrl}
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
              aria-label={playing ? t("pause") : t("play")}
              title={playing ? t("pause") : t("play")}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={ctrl}
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
              aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
              title={fullscreen ? t("exitFullscreen") : t("fullscreen")}
            >
              {fullscreen ? <Minimize aria-hidden="true" /> : <Expand aria-hidden="true" />}
            </button>
          </div>
        </div>

        {total > 1 && (
          <>
            <button type="button" className={cn(ctrl, "absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-4")} onClick={() => (setPlaying(false), go(-1))} aria-label={t("prev")}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className={cn(ctrl, "absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-4")} onClick={() => (setPlaying(false), go(1))} aria-label={t("next")}>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6" aria-live="polite">
          <h3 className="text-2xl font-extrabold text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] sm:text-3xl">{slide.title}</h3>
          {slide.caption && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-white/85 sm:text-base">{slide.caption}</p>}
        </div>
        {playing && total > 1 && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 h-1 bg-white/15">
            <span key={index} className="block h-full origin-left bg-saffron" style={{ animation: `vt-progress ${INTERVAL}ms linear both` }} />
          </span>
        )}
      </div>

      <div className={cn("space-y-3 px-3 pb-3 pt-3 sm:px-4", fullscreen && "shrink-0")}>
        <nav aria-label={t("photos", { title })}>
          <ol className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {slides.map((s, i) => (
              <li key={s.image} className="w-28 shrink-0 snap-start sm:w-36">
                <button
                  type="button"
                  onClick={() => (setPlaying(false), setIndex(i))}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={t("showPhoto", { index: i + 1, title: s.title })}
                  className={cn("block w-full overflow-hidden rounded-xl ring-2 transition", i === index ? "ring-saffron" : "ring-transparent hover:ring-white/40")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local pre-sized photos */}
                  <img src={s.image} alt="" loading="lazy" decoding="async" width={320} height={213} className="aspect-[3/2] h-auto w-full object-cover" />
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p className="text-xs text-white/70">
          {t("credit", { author: slide.credit.author, license: slide.credit.license })} ·{" "}
          <a href={slide.credit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            Wikimedia Commons
          </a>
        </p>
      </div>
    </div>
  );
}
