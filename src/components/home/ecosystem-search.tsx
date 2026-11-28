"use client";

import { GlassSelect } from "@/components/ui/glass-select";
import { BedDouble, CalendarDays, Compass, MapPin, Search, Sparkles, TrainFront, Users, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ComponentType, type ReactNode } from "react";

type Tab = "tours" | "hotels" | "restaurants" | "transport" | "ai";
const TABS: { key: Tab; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { key: "tours", icon: Compass },
  { key: "hotels", icon: BedDouble },
  { key: "restaurants", icon: UtensilsCrossed },
  { key: "transport", icon: TrainFront },
  { key: "ai", icon: Sparkles },
];

export interface SearchOptions {
  destinations: { slug: string; name: string }[];
  /** Cities offered in the transport search (value = what /transport expects). */
  cities: { value: string; name: string }[];
  months: { value: number; label: string }[];
  people: string[];
  labels: { destination: string; anyDestination: string; when: string; anyDate: string; travelers: string };
}

const segment = "flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 sm:px-5";
const control = "w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[0.95rem] font-semibold text-ink focus:outline-none";

function Field({ icon: Icon, label, children, wide }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`${segment} ${wide ? "sm:flex-[1.4]" : ""}`}>
      <Icon aria-hidden={true} className="size-5 shrink-0 text-lapis" />
      <span className="relative min-w-0 flex-1">
        <span className="block text-xs font-medium text-ink-muted">{label}</span>
        {children}
      </span>
    </label>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-4 h-px bg-line sm:mx-0 sm:h-9 sm:w-px" />;

/** The hero search: one box for tours, hotels, restaurants, flights & trains and the AI guide. */
export function EcosystemSearch({ locale, options }: { locale: string; options: SearchOptions }) {
  const t = useTranslations("eco.home.search");
  const [tab, setTab] = useState<Tab>("tours");
  const id = useId();
  const today = new Date().toISOString().slice(0, 10);
  const L = options.labels;
  const destSelect = (name: string) => (
    <>
      <GlassSelect name={name} defaultValue="" className={control}>
        <option value="">{L.anyDestination}</option>
        {options.destinations.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </GlassSelect>
    </>
  );
  const guests = (name: string, label: string) => (
    <Field icon={Users} label={label}>
      <GlassSelect name={name} defaultValue="2" className={control}>
        {options.people.map((p, i) => (
          <option key={p} value={i + 1}>
            {p}
          </option>
        ))}
      </GlassSelect>
    </Field>
  );
  const submit = (label: string) => (
    <button type="submit" className="mt-2 inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-lapis-deep px-7 font-bold text-white transition-colors hover:bg-cobalt sm:mt-0">
      <Search aria-hidden="true" className="size-5" />
      {label}
    </button>
  );
  const formCls = "flex flex-col rounded-[1.75rem] bg-white p-2 shadow-lift sm:flex-row sm:items-center sm:rounded-full";

  return (
    <div className="animate-fade-up mt-8 max-w-[56rem] [animation-delay:120ms]">
      <div role="tablist" aria-label={t("label")} className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`${id}-panel`}
            onClick={() => setTab(key)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors ${tab === key ? "bg-lapis-deep text-white shadow-[0_8px_18px_-10px_rgb(15_42_71/0.9)]" : "bg-white/85 text-lapis-deep hover:bg-white"}`}
          >
            <Icon aria-hidden={true} className="size-4" />
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
        {tab === "tours" && (
          <form action={`/${locale}/tours`} method="get" role="search" aria-label={t("tabs.tours")} className={formCls}>
            <Field icon={MapPin} label={L.destination} wide>
              {destSelect("destination")}
            </Field>
            <Divider />
            <Field icon={CalendarDays} label={L.when}>
              <GlassSelect name="month" defaultValue="" className={control}>
                <option value="">{L.anyDate}</option>
                {options.months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </GlassSelect>
            </Field>
            <Divider />
            {guests("guests", L.travelers)}
            {submit(t("submitTours"))}
          </form>
        )}
        {tab === "hotels" && (
          <form action={`/${locale}/hotels`} method="get" role="search" aria-label={t("tabs.hotels")} className={formCls}>
            <Field icon={MapPin} label={t("destination")} wide>
              {destSelect("destination")}
            </Field>
            <Divider />
            <Field icon={CalendarDays} label={t("checkIn")}>
              <input type="date" name="checkIn" min={today} className={`${control} cursor-text pr-0`} />
            </Field>
            <Divider />
            {guests("guests", t("guests"))}
            {submit(t("submitHotels"))}
          </form>
        )}
        {tab === "restaurants" && (
          <form action={`/${locale}/restaurants`} method="get" role="search" aria-label={t("tabs.restaurants")} className={formCls}>
            <Field icon={MapPin} label={t("destination")} wide>
              {destSelect("destination")}
            </Field>
            <Divider />
            <Field icon={UtensilsCrossed} label={t("cuisine")} wide>
              <input type="text" name="q" maxLength={80} placeholder={t("cuisinePlaceholder")} className={`${control} cursor-text pr-0 font-medium placeholder:text-ink-muted`} />
            </Field>
            {submit(t("submitRestaurants"))}
          </form>
        )}
        {tab === "transport" && (
          <form action={`/${locale}/transport`} method="get" role="search" aria-label={t("tabs.transport")} className={formCls}>
            {(["from", "to"] as const).map((k, i) => (
              <span key={k} className="contents">
                {i > 0 && <Divider />}
                <Field icon={MapPin} label={t(k)}>
                  <GlassSelect name={k} defaultValue={options.cities[i]?.value ?? ""} className={control}>
                    {options.cities.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.name}
                      </option>
                    ))}
                  </GlassSelect>
                </Field>
              </span>
            ))}
            <Divider />
            <Field icon={CalendarDays} label={t("date")}>
              <input type="date" name="date" min={today} className={`${control} cursor-text pr-0`} />
            </Field>
            <Divider />
            {guests("pax", t("passengers"))}
            {submit(t("submitTransport"))}
          </form>
        )}
        {tab === "ai" && (
          <form action={`/${locale}/ai-guide`} method="get" role="search" aria-label={t("tabs.ai")} className={formCls}>
            <Field icon={Sparkles} label={t("question")} wide>
              <input type="text" name="q" required maxLength={300} placeholder={t("questionPlaceholder")} className={`${control} cursor-text pr-0 font-medium placeholder:text-ink-muted`} />
            </Field>
            {submit(t("submitAi"))}
          </form>
        )}
      </div>
    </div>
  );
}
