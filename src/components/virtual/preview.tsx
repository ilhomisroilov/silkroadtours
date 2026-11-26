import { ArrowRight, Camera, Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/db/types";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/localize";
import { getVirtualTour, panoramaTours, stopCount, VIRTUAL_TOURS, type VirtualTour } from "@/data/virtual-tours";
import { PanoramaBand } from "./panorama-band";

const PREVIEW = ["tashkent", "samarkand", "bukhara"];

/**
 * Homepage teaser for the virtual tours: a drifting 360° horizon strip (plain images + CSS, the
 * panorama viewer is not loaded here), a "Start virtual tour" call to action and the three 360° cities.
 */
export async function VirtualToursPreview({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "virtualTours" });
  const lead = panoramaTours()[0];
  if (!lead) return null;
  const tours = PREVIEW.map((slug) => getVirtualTour(slug)).filter((x): x is VirtualTour => !!x);
  const sceneTotal = panoramaTours().reduce((n, x) => n + x.scenes.length, 0);
  const cities = new Set(VIRTUAL_TOURS.map((x) => x.destinationSlug)).size;

  return (
    <section className="container-page pt-20" aria-labelledby="vt-preview-title">
      <div className="on-dark relative isolate overflow-hidden rounded-[1.75rem] bg-lapis-night text-white shadow-lift">
        <PanoramaBand src={lead.band} className="-z-10" duration={160} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,54,0.35)_0%,rgba(11,31,54,0.55)_45%,rgba(11,31,54,0.95)_100%)] lg:bg-[linear-gradient(90deg,rgba(11,31,54,0.92)_0%,rgba(11,31,54,0.7)_40%,rgba(11,31,54,0.15)_75%)]" />
        <div className="grid gap-8 px-5 pb-6 pt-10 sm:px-8 lg:grid-cols-12 lg:items-end lg:px-10 lg:pb-10 lg:pt-16">
          <div className="lg:col-span-6">
            <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em] text-saffron">
              <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-2.5 py-0.5 text-xs tracking-normal text-lapis-deep">
                <Compass aria-hidden="true" className="size-3.5" /> 360°
              </span>
              {t("preview.eyebrow")}
            </p>
            <h2 id="vt-preview-title" className="mt-4 text-[clamp(2rem,1.4rem+2.4vw,3.2rem)] leading-[1.06] text-white">
              {t("preview.title")}
            </h2>
            <p className="mt-4 max-w-lg text-lg text-white/85">{t("preview.text")}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/virtual-tours/${lead.slug}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-saffron px-6 font-bold text-lapis-deep transition hover:bg-saffron-soft"
              >
                <Compass aria-hidden="true" className="size-5" /> {t("preview.cta")}
              </Link>
              <Link href="/virtual-tours" className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-bold text-white underline-offset-4 hover:underline">
                {t("preview.all")} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-6">
            {tours.map((tour) => (
              <li key={tour.slug}>
                <Link
                  href={`/virtual-tours/${tour.slug}`}
                  className="group flex items-center gap-3 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 sm:flex-col sm:items-stretch"
                >
                  <span className="relative block aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl sm:w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized still */}
                    <img
                      src={tour.cover}
                      alt=""
                      width={480}
                      height={270}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </span>
                  <span className="min-w-0 px-1 pb-1">
                    <span className="block font-bold leading-tight text-white">{localize(tour.place, locale)}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
                      {tour.mode === "360" ? <Compass aria-hidden="true" className="size-3.5 text-saffron" /> : <Camera aria-hidden="true" className="size-3.5" />}
                      {tour.mode === "360" ? t("hub.mode360") : t("hub.modePhoto")} · {tour.mode === "360" ? t("hub.scenes", { count: stopCount(tour) }) : t("hub.photos", { count: stopCount(tour) })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1 border-t border-white/10 px-5 py-3 text-[0.72rem] text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span className="inline-flex items-center gap-1.5">
            <Compass aria-hidden="true" className="size-3.5" /> {t("hub.statScenes", { count: sceneTotal })} · {t("hub.statCities", { count: cities })}
          </span>
          <span>
            {t("viewer.credit", { author: lead.bandCredit.author, license: lead.bandCredit.license })} ·{" "}
            <a href={lead.bandCredit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              Wikimedia Commons
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
