"use client";

import {
  AlertTriangle,
  Compass,
  Expand,
  Hand,
  Info,
  LocateFixed,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { GirihRosette } from "@/components/ornament";
import { cn } from "@/lib/cn";
import type { ViewerHotspot, ViewerScene } from "./types";
import "./virtual.css";

/* ── Pannellum (vendored in public/vendor/pannellum, MIT) ─────────────────── */

interface PannellumViewer {
  on(event: string, cb: (...args: unknown[]) => void): PannellumViewer;
  destroy(): void;
  getHfov(): number;
  setHfov(hfov: number, animated?: boolean | number): PannellumViewer;
  getHfovBounds(): [number, number];
  lookAt(pitch?: number, yaw?: number, hfov?: number, animated?: boolean | number): PannellumViewer;
  loadScene(sceneId: string, pitch?: number, yaw?: number, hfov?: number): void;
  getScene(): string;
  startAutoRotate(speed?: number, pitch?: number): PannellumViewer;
  stopAutoRotate(): PannellumViewer;
  resize(): void;
  isOrientationSupported(): boolean;
  isOrientationActive(): boolean;
  startOrientation(): void;
  stopOrientation(): void;
}
interface PannellumGlobal {
  viewer(container: HTMLElement, config: Record<string, unknown>): PannellumViewer;
}
declare global {
  interface Window {
    pannellum?: PannellumGlobal;
  }
}

const SCRIPT = "/vendor/pannellum/pannellum.js";
const STYLES = "/vendor/pannellum/pannellum.css";
const ROTATE_SPEED = -1.6;
let loader: Promise<PannellumGlobal> | null = null;

/** Adds Pannellum's script and stylesheet once per page, only when a viewer is on screen. */
function loadPannellum(): Promise<PannellumGlobal> {
  if (window.pannellum) return Promise.resolve(window.pannellum);
  if (loader) return loader;
  loader = new Promise<PannellumGlobal>((resolve, reject) => {
    if (!document.querySelector(`link[href="${STYLES}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLES;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.pannellum ? resolve(window.pannellum) : reject(new Error("pannellum")));
    script.onerror = () => {
      script.remove();
      reject(new Error("pannellum"));
    };
    document.head.appendChild(script);
  }).catch((e) => {
    loader = null;
    throw e;
  });
  return loader;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

const ICON_INFO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 11v6M12 7.2v.1"/></svg>';
const ICON_WALK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

type Status = "loading" | "ready" | "error" | "unsupported";

/** Narrow (portrait) screens get a tighter horizontal field of view so the vertical one stays natural (≈95°). */
function fitHfov(hfov: number, el: HTMLElement | null): number {
  if (!el || !el.clientHeight) return hfov;
  const aspect = el.clientWidth / el.clientHeight;
  const maxForAspect = (2 * Math.atan(Math.tan((95 * Math.PI) / 360) * aspect) * 180) / Math.PI;
  return Math.round(Math.max(50, Math.min(hfov, maxForAspect)));
}

/**
 * Interactive 360° viewer for a multi-scene tour: drag / swipe / arrow keys to look around,
 * mouse wheel, pinch or the buttons to zoom, hotspots that tell a story or walk to the next scene,
 * a scene strip, fullscreen and gentle auto-rotation (off for reduced motion).
 */
export function PanoramaViewer({ scenes, title, initialScene }: { scenes: ViewerScene[]; title: string; initialScene?: string }) {
  const t = useTranslations("virtualTours.viewer");
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PannellumViewer | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [sceneId, setSceneId] = useState(initialScene && scenes.some((s) => s.id === initialScene) ? initialScene : scenes[0]!.id);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [info, setInfo] = useState<ViewerHotspot | null>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [hint, setHint] = useState(true);
  const [canOrient, setCanOrient] = useState(false);
  const [orienting, setOrienting] = useState(false);
  const sceneRef = useRef(sceneId);
  sceneRef.current = sceneId;
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0]!;
  const index = scenes.indexOf(scene);
  const fullscreen = nativeFs || pseudoFs;

  const goTo = useCallback(
    (id: string) => {
      if (id === sceneRef.current) return;
      const v = viewerRef.current;
      setInfo(null);
      if (v && status !== "error") {
        setSceneLoading(true);
        v.loadScene(id);
      } else {
        setSceneId(id);
        setAttempt((a) => a + 1);
      }
    },
    [status],
  );

  const activate = useCallback(
    (hs: ViewerHotspot) => {
      setHint(false);
      if (hs.kind === "scene" && hs.target) {
        goTo(hs.target);
        return;
      }
      setInfo(hs);
      viewerRef.current?.stopAutoRotate();
      setRotating(false);
      viewerRef.current?.lookAt(hs.pitch, hs.yaw, undefined, 700);
    },
    [goTo],
  );
  const activateRef = useRef(activate);
  activateRef.current = activate;
  const labelsRef = useRef({ goTo: (name: string) => t("goTo", { name }) });
  labelsRef.current = { goTo: (name: string) => t("goTo", { name }) };

  // Create the viewer (again after "Try again").
  useEffect(() => {
    let cancelled = false;
    let viewer: PannellumViewer | null = null;
    if (!hasWebGL()) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    loadPannellum()
      .then((p) => {
        const el = stageRef.current;
        if (cancelled || !el) return;
        const sceneConfig: Record<string, unknown> = {};
        for (const s of scenes) {
          sceneConfig[s.id] = {
            type: "equirectangular",
            panorama: s.image,
            yaw: s.yaw,
            pitch: s.pitch,
            hfov: fitHfov(s.hfov, el),
            hotSpots: s.hotspots.map((hs) => ({
              id: hs.id,
              pitch: hs.pitch,
              yaw: hs.yaw,
              type: "info",
              cssClass: cn("vt-hs", hs.kind === "scene" ? "vt-hs-scene" : "vt-hs-info"),
              createTooltipFunc: (div: HTMLElement) => {
                const label = hs.kind === "scene" ? labelsRef.current.goTo(hs.label) : hs.label;
                div.setAttribute("role", "button");
                div.tabIndex = 0;
                div.setAttribute("aria-label", label);
                const dot = document.createElement("span");
                dot.className = "vt-hs-dot";
                dot.setAttribute("aria-hidden", "true");
                dot.innerHTML = hs.kind === "scene" ? ICON_WALK : ICON_INFO;
                const tip = document.createElement("span");
                tip.className = "vt-hs-tip";
                tip.setAttribute("aria-hidden", "true");
                tip.textContent = hs.label;
                div.appendChild(dot);
                div.appendChild(tip);
                div.addEventListener("keydown", (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    activateRef.current(hs);
                  }
                });
              },
              clickHandlerFunc: () => activateRef.current(hs),
            })),
          };
        }
        viewer = p.viewer(el, {
          default: {
            firstScene: sceneRef.current,
            sceneFadeDuration: 900,
            autoLoad: true,
            showControls: false,
            compass: false,
            keyboardZoom: true,
            mouseZoom: true,
            draggable: true,
            friction: 0.18,
            minHfov: 35,
            maxHfov: 115,
            autoRotate: reduceMotion ? false : ROTATE_SPEED,
          },
          scenes: sceneConfig,
        });
        viewerRef.current = viewer;
        el.setAttribute("role", "application");
        el.setAttribute("aria-roledescription", t("roleDescription"));
        el.setAttribute("aria-describedby", "vt-keys-help");
        setRotating(!reduceMotion);
        viewer.on("load", () => {
          if (cancelled) return;
          setStatus("ready");
          setSceneLoading(false);
          if (viewer?.isOrientationSupported() && window.matchMedia("(pointer: coarse)").matches) setCanOrient(true);
        });
        viewer.on("scenechange", (id) => {
          if (cancelled) return;
          setSceneId(String(id));
          setInfo(null);
          setSceneLoading(true);
        });
        viewer.on("error", () => !cancelled && setStatus("error"));
        const stop = () => {
          setRotating(false);
          setHint(false);
        };
        viewer.on("mousedown", stop);
        viewer.on("touchstart", stop);
        el.addEventListener("keydown", stop);
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      try {
        viewer?.destroy();
      } catch {
        // already gone
      }
      viewerRef.current = null;
    };
    // The scene list is fixed for one page; re-create only when the visitor retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Keep the accessible name in sync with the scene on screen.
  useEffect(() => {
    stageRef.current?.setAttribute("aria-label", t("stageLabel", { title: scene.title }));
  }, [scene.title, status, t]);

  // Fullscreen: the Fullscreen API where it exists, a fixed full-window layer elsewhere (iPhone).
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
  useEffect(() => {
    const id = requestAnimationFrame(() => viewerRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(id);
  }, [hint]);

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (pseudoFs) {
      setPseudoFs(false);
      return;
    }
    if (document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // fall through to the full-window layer
      }
    }
    setPseudoFs(true);
  }

  function zoom(delta: number) {
    const v = viewerRef.current;
    if (!v) return;
    setHint(false);
    v.setHfov(v.getHfov() + delta, 350);
  }
  function resetView() {
    setInfo(null);
    viewerRef.current?.lookAt(scene.pitch, scene.yaw, fitHfov(scene.hfov, stageRef.current), 800);
  }
  function toggleRotate() {
    const v = viewerRef.current;
    if (!v) return;
    if (rotating) v.stopAutoRotate();
    else v.startAutoRotate(ROTATE_SPEED);
    setRotating(!rotating);
  }
  async function toggleOrientation() {
    const v = viewerRef.current;
    if (!v) return;
    if (orienting) {
      v.stopOrientation();
      setOrienting(false);
      return;
    }
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DOE?.requestPermission) {
      const res = await DOE.requestPermission().catch(() => "denied");
      if (res !== "granted") return;
    }
    v.startOrientation();
    setOrienting(true);
  }

  const ctrl =
    "pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-lapis-night/70 text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-lapis-night/90 disabled:opacity-40 [&_svg]:size-5";
  const ready = status === "ready";

  return (
    <div
      ref={shellRef}
      className={cn(
        "on-dark flex flex-col overflow-hidden bg-lapis-night text-white",
        fullscreen ? "fixed inset-0 z-[100] h-[100dvh] w-screen" : "relative rounded-[var(--radius-card)] shadow-lift",
      )}
    >
      <div className={cn("relative isolate w-full", fullscreen ? "min-h-0 flex-1" : "h-[62svh] min-h-[20rem] sm:h-[min(74vh,42rem)]")}>
        <div ref={stageRef} className="vt-stage absolute inset-0" />

        {/* Loading, error and unsupported states */}
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized still of the scene */}
            <img src={scene.thumb} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[3px]" />
            <div className="absolute inset-0 bg-lapis-night/65" />
            <div className="relative flex max-w-sm flex-col items-center gap-3 px-6 text-center" role="status" aria-live="polite">
              {status === "loading" && (
                <>
                  <GirihRosette size={52} tone="saffron" className="animate-spin-slow" />
                  <p className="font-semibold">{t("loading")}</p>
                  <p className="text-sm text-white/75">{scene.title}</p>
                </>
              )}
              {status === "error" && (
                <>
                  <AlertTriangle aria-hidden="true" className="size-9 text-saffron" />
                  <p className="font-semibold">{t("error")}</p>
                  <button
                    type="button"
                    onClick={() => setAttempt((a) => a + 1)}
                    className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-5 font-bold text-lapis-deep hover:bg-saffron-soft"
                  >
                    <RotateCcw aria-hidden="true" className="size-4" /> {t("retry")}
                  </button>
                </>
              )}
              {status === "unsupported" && (
                <>
                  <Info aria-hidden="true" className="size-9 text-saffron" />
                  <p className="font-semibold">{t("unsupported")}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top bar: scene title and controls */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-lapis-night/70 via-lapis-night/25 to-transparent p-3 sm:p-4">
          <div className="min-w-0 pt-1">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-saffron">
              <span className="rounded-full bg-saffron px-2 py-0.5 text-[0.7rem] tracking-normal text-lapis-deep">360°</span>
              {t("sceneOf", { index: index + 1, total: scenes.length })}
            </p>
            <h3 className="mt-1 truncate text-lg font-extrabold text-white sm:text-xl [text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">{scene.title}</h3>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row" role="toolbar" aria-label={t("controls")}>
            <button type="button" className={ctrl} onClick={() => zoom(-15)} disabled={!ready} aria-label={t("zoomIn")} title={t("zoomIn")}>
              <ZoomIn aria-hidden="true" />
            </button>
            <button type="button" className={ctrl} onClick={() => zoom(15)} disabled={!ready} aria-label={t("zoomOut")} title={t("zoomOut")}>
              <ZoomOut aria-hidden="true" />
            </button>
            <button type="button" className={ctrl} onClick={resetView} disabled={!ready} aria-label={t("reset")} title={t("reset")}>
              <LocateFixed aria-hidden="true" />
            </button>
            <button
              type="button"
              className={ctrl}
              onClick={toggleRotate}
              disabled={!ready}
              aria-pressed={rotating}
              aria-label={rotating ? t("pauseRotate") : t("playRotate")}
              title={rotating ? t("pauseRotate") : t("playRotate")}
            >
              {rotating ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            {canOrient && (
              <button type="button" className={ctrl} onClick={toggleOrientation} aria-pressed={orienting} aria-label={t("motion")} title={t("motion")}>
                <Compass aria-hidden="true" />
              </button>
            )}
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

        {/* Scene change indicator */}
        {ready && sceneLoading && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <GirihRosette size={44} tone="saffron" className="animate-spin-slow" />
          </div>
        )}

        {/* First-visit hint */}
        {ready && hint && !info && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-lapis-night/75 px-4 py-2 text-sm font-semibold backdrop-blur">
            <Hand aria-hidden="true" className="size-4 text-saffron" /> {t("hint")}
          </p>
        )}

        {/* Story panel for info hotspots */}
        <div aria-live="polite" className="absolute inset-x-3 bottom-3 z-30 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[22rem]">
          {info && (
            <div className="rounded-2xl bg-white p-4 text-ink shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-lg font-extrabold leading-snug text-lapis">{info.label}</h4>
                <button
                  type="button"
                  onClick={() => setInfo(null)}
                  className="-m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sky hover:text-lapis"
                  aria-label={t("closeInfo")}
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>
              {info.text && <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink/80">{info.text}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Below the stage: points of interest, scene strip and credits */}
      <div className={cn("space-y-3 px-3 pb-3 pt-3 sm:px-4", fullscreen && "shrink-0")}>
        {scene.hotspots.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <span className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-white/70">{t("inThisView")}</span>
            {scene.hotspots.map((hs) => (
              <button
                key={hs.id}
                type="button"
                onClick={() => activate(hs)}
                disabled={!ready}
                aria-pressed={hs.kind === "info" ? info?.id === hs.id : undefined}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition disabled:opacity-50",
                  hs.kind === "scene"
                    ? "bg-saffron text-lapis-deep hover:bg-saffron-soft"
                    : info?.id === hs.id
                      ? "bg-ivory text-lapis-deep ring-1 ring-saffron"
                      : "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20",
                )}
              >
                {hs.kind === "scene" ? t("goTo", { name: hs.label }) : hs.label}
              </button>
            ))}
          </div>
        )}
        {scenes.length > 1 && (
          <nav aria-label={t("scenes", { title })}>
            <ol className="flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {scenes.map((s, i) => {
                const active = s.id === scene.id;
                return (
                  <li key={s.id} className="w-36 shrink-0 snap-start sm:w-44">
                    <button
                      type="button"
                      onClick={() => goTo(s.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "group block w-full overflow-hidden rounded-xl text-left ring-2 transition",
                        active ? "ring-saffron" : "ring-transparent hover:ring-white/40",
                      )}
                    >
                      <span className="relative block aspect-[16/9] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized still */}
                        <img src={s.thumb} alt="" loading="lazy" decoding="async" width={480} height={270} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-lapis-night/75 px-1.5 text-[0.7rem] font-bold">{i + 1}</span>
                      </span>
                      <span className={cn("block truncate px-2 py-1.5 text-[0.8rem] font-semibold", active ? "bg-saffron text-lapis-deep" : "bg-white/8 text-white/90")}>
                        {s.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <div className="flex flex-col gap-1 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p id="vt-keys-help">{t("keys")}</p>
          <p>
            {t("credit", { author: scene.credit.author, license: scene.credit.license })} ·{" "}
            <a href={scene.credit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              Wikimedia Commons
            </a>
          </p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {ready ? scene.title : ""}
      </p>
    </div>
  );
}
