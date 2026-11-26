"use client";

import { CalendarDays, Info, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { BookingType, Currency, DepartureStatus, Locale } from "@/db/types";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/format";
import { formatMoney, type QuoteResult } from "@/lib/pricing";
import { todayInTashkent } from "@/validators/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import dynamic from "next/dynamic";

/** The date picker code is downloaded when a calendar popover is first opened. */
const Calendar = dynamic(() => import("@/components/ui/calendar").then((m) => m.Calendar), { ssr: false });

export interface DepartureOption {
  id: number;
  startDate: string;
  endDate: string;
  seatsTotal: number;
  seatsBooked: number;
  status: DepartureStatus;
  priceModifierPercent: number;
}

type Priced = Extract<QuoteResult, { ok: true }>;

interface BookingState {
  type: BookingType;
  adults: number;
  children: number;
  departureId: number | null;
  date: string | null;
}

interface Ctx {
  slug: string;
  currency: Currency;
  types: BookingType[];
  minGroup: number;
  maxGroup: number;
  departures: DepartureOption[];
  state: BookingState;
  set: (patch: Partial<BookingState>) => void;
  quote: Priced | null;
  error: string | null;
  loading: boolean;
  bookHref: () => string;
}

const BookingCtx = createContext<Ctx | null>(null);
const useBooking = () => {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("BookingProvider missing");
  return c;
};

const seatsLeft = (d: DepartureOption) => Math.max(0, d.seatsTotal - d.seatsBooked);
const bookable = (d: DepartureOption) => d.status !== "cancelled" && d.status !== "sold_out" && seatsLeft(d) > 0;

/** Holds the trip selection shared by the sticky card and the mobile bottom bar; fetches live quotes. */
export function BookingProvider({
  slug,
  currency,
  types,
  minGroup,
  maxGroup,
  departures,
  initial,
  initialQuote,
  children,
}: {
  slug: string;
  currency: Currency;
  types: BookingType[];
  minGroup: number;
  maxGroup: number;
  departures: DepartureOption[];
  initial: BookingState;
  initialQuote: Priced | null;
  children: ReactNode;
}) {
  const locale = useLocale() as Locale;
  const [state, setState] = useState<BookingState>(initial);
  const [quote, setQuote] = useState<Priced | null>(initialQuote);
  const [error, setError] = useState<string | null>(initialQuote ? null : null);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const te = useTranslations("errors");

  const set = useCallback((patch: Partial<BookingState>) => setState((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    if (first.current && initialQuote && currency === initialQuote.currency) {
      first.current = false;
      return;
    }
    first.current = false;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({
        adults: String(state.adults),
        children: String(state.children),
        type: state.type,
        currency,
      });
      if (state.type === "group" && state.departureId) params.set("departureId", String(state.departureId));
      try {
        const res = await fetch(`/api/tours/${slug}/quote?${params}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        const json = (await res.json()) as { data?: Priced; error?: { code: string } };
        if (res.ok && json.data) {
          setQuote(json.data);
          setError(null);
        } else {
          setQuote(null);
          const code = json.error?.code ?? "internal_error";
          setError(te.has(code as never) ? te(code as never) : te("internal_error"));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(te("internal_error"));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [slug, currency, state.adults, state.children, state.type, state.departureId, initialQuote, te]);

  const bookHref = useCallback(() => {
    const q = new URLSearchParams({ type: state.type, adults: String(state.adults), children: String(state.children) });
    if (state.type === "group" && state.departureId) q.set("departureId", String(state.departureId));
    if (state.date) q.set("date", state.date);
    return `/book/${slug}?${q}`;
  }, [slug, state]);

  const value = useMemo(
    () => ({ slug, currency, types, minGroup, maxGroup, departures, state, set, quote, error, loading, bookHref, locale }),
    [slug, currency, types, minGroup, maxGroup, departures, state, set, quote, error, loading, bookHref, locale],
  );
  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

function Stepper({ label, value, min, max, onChange, testId }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; testId: string }) {
  const t = useTranslations("common");
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex items-center justify-between gap-3">
      <span id={id} className="font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-1 rounded-full border border-field bg-white p-0.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={t("decrease", { label })}
          data-testid={`${testId}-dec`}
          className="inline-flex size-11 items-center justify-center rounded-full text-lapis hover:bg-sand-soft disabled:text-ink-muted/40"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <output aria-live="polite" className="w-8 text-center text-lg font-bold" data-testid={`${testId}-value`}>{value}</output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={t("increase", { label })}
          data-testid={`${testId}-inc`}
          className="inline-flex size-11 items-center justify-center rounded-full text-lapis hover:bg-sand-soft disabled:text-ink-muted/40"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function DeparturePicker({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("tour");
  const tm = useTranslations("monthsShort");
  const { departures, state, set } = useBooking();
  const [open, setOpen] = useState(false);
  const ms = (m: number) => tm(String(m) as never);
  const available = departures.filter(bookable);
  const chips = available.slice(0, 4);
  const selected = departures.find((d) => d.id === state.departureId) ?? null;
  const byDate = new Map(departures.map((d) => [d.startDate, d]));

  if (state.type === "private") {
    const minDate = fromIso(todayInTashkent(new Date(Date.now() + 2 * 86400_000)));
    return (
      <div>
        <p className="mb-2 font-semibold text-ink">{t("flexibleDate")}</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" data-testid={`${idPrefix}-date-trigger`} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-field bg-white px-3.5 text-left">
              <span>{state.date ? formatDateLabel(state.date, ms) : t("pickDate")}</span>
              <CalendarDays aria-hidden="true" className="size-5 text-lapis" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="relative w-auto p-2">
            <Calendar
              mode="single"
              selected={state.date ? fromIso(state.date) : undefined}
              defaultMonth={state.date ? fromIso(state.date) : minDate}
              disabled={{ before: minDate }}
              onSelect={(d) => {
                if (d) set({ date: iso(d), departureId: null });
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-ink">{t("departure")}</legend>
      {available.length === 0 ? (
        <p className="rounded-sm bg-sand-soft p-3 text-sm text-ink-muted">{t("noDepartures")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {chips.map((d) => {
              const active = d.id === state.departureId;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={active}
                  data-testid={`${idPrefix}-departure-chip`}
                  onClick={() => set({ departureId: d.id, date: d.startDate })}
                  className={cn(
                    "flex min-h-14 flex-col items-start justify-center rounded-sm border px-3 py-1.5 text-left text-sm transition-colors",
                    active ? "border-lapis bg-lapis text-white" : "border-field bg-white hover:border-lapis",
                  )}
                >
                  <span className="font-bold">{formatDateLabel(d.startDate, ms, false)}</span>
                  <span className={cn("text-xs", active ? "text-lapis-mist" : seatsLeft(d) <= 3 ? "font-semibold text-pomegranate" : "text-ink-muted")}>
                    {t("seatsLeft", { count: seatsLeft(d) })}
                  </span>
                </button>
              );
            })}
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" data-testid={`${idPrefix}-calendar-trigger`} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cobalt underline">
                <CalendarDays aria-hidden="true" className="size-4" /> {t("chooseDeparture")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="relative w-auto p-2">
              <Calendar
                mode="single"
                selected={selected ? fromIso(selected.startDate) : undefined}
                defaultMonth={fromIso((selected ?? available[0]!).startDate)}
                disabled={(day) => {
                  const d = byDate.get(iso(day));
                  return !d || !bookable(d);
                }}
                modifiers={{ departure: (day) => byDate.has(iso(day)) }}
                modifiersClassNames={{ departure: "[&>button]:font-bold [&>button]:text-lapis [&>button]:underline [&>button]:decoration-saffron [&>button]:decoration-2" }}
                onSelect={(day) => {
                  const d = day ? byDate.get(iso(day)) : undefined;
                  if (d) set({ departureId: d.id, date: d.startDate });
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {selected && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink" data-testid={`${idPrefix}-selected-departure`}>
              <span className="font-semibold">{t("selectedDate", { date: `${formatDateLabel(selected.startDate, ms)} – ${formatDateLabel(selected.endDate, ms)}` })}</span>
              {selected.status === "guaranteed" && <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-white">{t("guaranteed")}</span>}
              {selected.priceModifierPercent !== 0 && (
                <span className="text-xs text-ink-muted">{t("priceModifier", { percent: selected.priceModifierPercent > 0 ? `+${selected.priceModifierPercent}` : selected.priceModifierPercent })}</span>
              )}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

function PriceSummary({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("tour");
  const locale = useLocale() as Locale;
  const { quote, error, loading, state } = useBooking();
  return (
    <div className="rounded-sm bg-sand-soft p-4" aria-live="polite" aria-busy={loading}>
      {error ? (
        <p role="alert" className="flex gap-2 text-sm font-semibold text-danger" data-testid={`${idPrefix}-quote-error`}>
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : quote ? (
        <dl className={cn("space-y-1.5 text-sm transition-opacity", loading && "opacity-50")}>
          <div className="flex justify-between gap-3">
            <dt>{t("subtotalAdults", { count: state.adults, price: formatMoney(quote.perAdultMinor, quote.currency, locale) })}</dt>
            <dd className="font-semibold">{formatMoney(quote.adultsSubtotalMinor, quote.currency, locale)}</dd>
          </div>
          {state.children > 0 && (
            <div className="flex justify-between gap-3">
              <dt>{t("subtotalChildren", { count: state.children, price: formatMoney(quote.perChildMinor, quote.currency, locale) })}</dt>
              <dd className="font-semibold">{formatMoney(quote.childrenSubtotalMinor, quote.currency, locale)}</dd>
            </div>
          )}
          <div className="flex items-end justify-between gap-3 border-t border-line pt-2">
            <dt className="font-bold">{t("total")}</dt>
            <dd className="text-2xl font-bold text-lapis-deep" data-testid={`${idPrefix}-total`}>{formatMoney(quote.totalMinor, quote.currency, locale)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-ink-muted">
            <dt>{t("perAdult")}</dt>
            <dd data-testid={`${idPrefix}-per-adult`}>{formatMoney(quote.perAdultMinor, quote.currency, locale)}</dd>
          </div>
          {quote.isConverted && <p className="pt-1 text-xs text-ink-muted">{t("converted")}</p>}
        </dl>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" /> {t("quoteUpdating")}
        </p>
      )}
    </div>
  );
}

export function BookingCard({ idPrefix = "card", title, className }: { idPrefix?: string; title?: string; className?: string }) {
  const t = useTranslations("tour");
  const tc = useTranslations("common");
  const router = useRouter();
  const { types, state, set, minGroup, maxGroup, quote, error, bookHref } = useBooking();
  const pax = state.adults + state.children;
  const needsDate = state.type === "group" ? state.departureId == null : state.date == null;
  // Marks the card as interactive once React has taken over the server-rendered markup.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className={cn("flex flex-col gap-5", className)} data-testid={`${idPrefix}-booking-card`} data-ready={ready || undefined}>
      {title && <h2 className="font-display text-2xl text-lapis-deep">{title}</h2>}
      {types.length > 1 && (
        <div role="radiogroup" aria-label={t("bookingTitle")} className="grid grid-cols-2 gap-1 rounded-full bg-sand-soft p-1">
          {types.map((ty) => (
            <button
              key={ty}
              type="button"
              role="radio"
              aria-checked={state.type === ty}
              data-testid={`${idPrefix}-type-${ty}`}
              onClick={() => set({ type: ty, departureId: ty === "private" ? null : state.departureId, date: ty === "private" ? null : state.date })}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-semibold transition-colors",
                state.type === ty ? "bg-lapis text-white shadow" : "text-lapis-deep hover:bg-sand",
              )}
            >
              {t(ty)}
            </button>
          ))}
        </div>
      )}
      <p className="-mt-2 text-sm text-ink-muted">{t(state.type === "group" ? "groupHint" : "privateHint")}</p>
      <div className="space-y-3">
        <Stepper testId={`${idPrefix}-adults`} label={tc("adults")} value={state.adults} min={1} max={Math.max(1, maxGroup - state.children)} onChange={(v) => set({ adults: v })} />
        <Stepper testId={`${idPrefix}-children`} label={tc("children")} value={state.children} min={0} max={Math.max(0, maxGroup - state.adults)} onChange={(v) => set({ children: v })} />
        {pax < minGroup && <p className="text-sm text-pomegranate">{tc("groupSize", { min: minGroup, max: maxGroup })}</p>}
      </div>
      <DeparturePicker idPrefix={idPrefix} />
      <PriceSummary idPrefix={idPrefix} />
      <Button
        size="lg"
        disabled={!quote || !!error}
        data-testid={`${idPrefix}-book`}
        onClick={() => router.push(bookHref())}
      >
        {t("book")}
      </Button>
      {needsDate && <p className="-mt-3 text-center text-xs text-ink-muted">{t("dateHintShort")}</p>}
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-turquoise-ink" />
        {t("noPaymentNow")}
      </p>
    </div>
  );
}

/** Mobile: a fixed bar with the live total; "Book" opens the same card in a bottom sheet. */
export function MobileBookBar({ fromLabel }: { fromLabel: string }) {
  const t = useTranslations("tour");
  const tn = useTranslations("nav");
  const locale = useLocale() as Locale;
  const { quote } = useBooking();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ivory px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(20,35,92,0.3)] lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <p className="leading-tight">
            {quote ? (
              <>
                <span className="block text-xs text-ink-muted">{t("total")}</span>
                <span className="text-lg font-bold" data-testid="bar-total">{formatMoney(quote.totalMinor, quote.currency, locale)}</span>
              </>
            ) : (
              <span className="text-sm text-ink-muted">{fromLabel}</span>
            )}
          </p>
          <Button onClick={() => setOpen(true)} data-testid="bar-book">{t("bookShort")}</Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" closeLabel={tn("close")} aria-describedby={undefined} className="px-5 pb-8 pt-6">
          <DialogTitle className="mb-4 pr-10">{t("bookingTitle")}</DialogTitle>
          <BookingCard idPrefix="sheet" />
        </SheetContent>
      </Dialog>
    </>
  );
}
