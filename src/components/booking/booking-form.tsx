"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import type { BookingType, ContactChannel, Currency, Locale } from "@/db/types";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, translateCode } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/format";
import { formatMoney, type QuoteResult } from "@/lib/pricing";
import { bookingInputSchema } from "@/validators/booking";
import { todayInTashkent } from "@/validators/common";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { Turnstile, type TurnstileHandle } from "@/components/forms/turnstile";
import type { DepartureOption } from "@/components/tours/booking-card";

type FormIn = z.input<typeof bookingInputSchema>;
type FormOut = z.output<typeof bookingInputSchema>;
type Priced = Extract<QuoteResult, { ok: true }>;

const STEP_FIELDS: FieldPath<FormIn>[][] = [
  ["bookingType", "departureId", "preferredDate", "adults", "children"],
  ["fullName", "email", "phone", "contactChannel", "messengerHandle", "country", "specialRequests"],
  ["turnstileToken"],
];
const CHANNELS: ContactChannel[] = ["whatsapp", "telegram", "phone", "email"];

export function BookingForm({
  slug,
  tourTitle,
  currency,
  types,
  minGroup,
  maxGroup,
  departures,
  prefill,
  utmSource,
}: {
  slug: string;
  tourTitle: string;
  currency: Currency;
  types: BookingType[];
  minGroup: number;
  maxGroup: number;
  departures: DepartureOption[];
  prefill: { type: BookingType; adults: number; children: number; departureId?: number; date?: string };
  utmSource?: string;
}) {
  const t = useTranslations("booking");
  const tt = useTranslations("tour");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tf = useTranslations("forms");
  const tm = useTranslations("monthsShort");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState<Priced | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ms = (m: number) => tm(String(m) as never);
  const bookableDeps = departures.filter((d) => d.status !== "cancelled" && d.status !== "sold_out" && d.seatsTotal > d.seatsBooked);
  const firstDeparture = prefill.departureId && bookableDeps.some((d) => d.id === prefill.departureId) ? prefill.departureId : undefined;
  const depDate = (id?: number) => bookableDeps.find((d) => d.id === id)?.startDate;

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(bookingInputSchema),
    mode: "onTouched",
    defaultValues: {
      tourSlug: slug,
      bookingType: prefill.type,
      departureId: prefill.type === "group" ? firstDeparture : undefined,
      preferredDate: (prefill.type === "group" ? depDate(firstDeparture) : undefined) ?? prefill.date ?? "",
      adults: prefill.adults,
      children: prefill.children,
      fullName: "",
      email: "",
      phone: "",
      contactChannel: "whatsapp",
      messengerHandle: "",
      country: "",
      specialRequests: "",
      currency,
      locale,
      turnstileToken: "",
      utmSource,
    },
  });
  const { register, watch, setValue, trigger, handleSubmit, formState, setError, getValues } = form;
  const errors = formState.errors;
  const err = (name: keyof FormIn) => {
    const m = errors[name]?.message;
    return m ? translateCode(String(m), te as never) : undefined;
  };

  const type = watch("bookingType");
  const adults = Number(watch("adults"));
  const children = Number(watch("children"));
  const departureId = watch("departureId");
  const preferredDate = watch("preferredDate");
  const useDepartures = type === "group" && bookableDeps.length > 0;

  // Live quote for the current selection.
  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ adults: String(adults || 1), children: String(children || 0), type, currency });
    if (useDepartures && departureId) q.set("departureId", String(departureId));
    const timer = setTimeout(async () => {
      const r = await apiFetch<Priced>(`/api/tours/${slug}/quote?${q}`, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (r.ok) {
        setQuote(r.data);
        setQuoteError(null);
      } else {
        setQuote(null);
        setQuoteError(translateCode(r.error.code, te as never));
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [slug, currency, type, adults, children, departureId, useDepartures, te]);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  // Marks the form as interactive once React has taken over the server-rendered markup.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok && (step !== 0 || !quoteError)) setStep((s) => Math.min(2, s + 1));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const r = await apiFetch<{ reference: string }>("/api/bookings", { method: "POST", json: { ...values, departureId: useDepartures ? values.departureId : undefined } });
    if (r.ok) {
      router.push(`/booking/${r.data.reference}`);
      return;
    }
    // Keep everything the visitor typed; show what to fix.
    turnstile.current?.reset();
    if (r.error.code === "network_error") return setFormError(tf("networkError"));
    let firstStep = 2;
    for (const [path, codes] of Object.entries(r.error.fields ?? {})) {
      const name = path.split(".")[0] as FieldPath<FormIn>;
      setError(name, { message: codes[0] });
      const s = STEP_FIELDS.findIndex((f) => f.includes(name));
      if (s >= 0) firstStep = Math.min(firstStep, s);
    }
    setFormError(`${translateCode(r.error.code, te as never)} ${tf("keepInput")}`);
    setStep(firstStep);
  });

  const steps = [t("stepTrip"), t("stepTraveller"), t("stepReview")];
  const minDate = todayInTashkent(new Date(Date.now() + 86400_000));
  const values = getValues();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8" data-testid="booking-form" data-ready={ready || undefined}>
      <nav aria-label={t("stepsLabel")}>
        <ol className="flex gap-2">
          {steps.map((label, i) => (
            <li key={label} className="flex-1">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 border-t-4 pt-2 text-sm font-semibold",
                  i < step ? "border-turquoise-ink text-turquoise-ink" : i === step ? "border-terracotta text-ink" : "border-line text-ink-muted",
                )}
              >
                {i < step ? <Check aria-hidden="true" className="size-4" /> : <span aria-hidden="true">{i + 1}.</span>}
                {label}
              </span>
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">{t("step", { current: step + 1, total: 3 })}</p>
      </nav>

      {formError && (
        <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-4 font-semibold text-danger" data-testid="form-error">
          {formError}
        </div>
      )}

      {/* Step 1 — trip */}
      <fieldset hidden={step !== 0} className="flex flex-col gap-5">
        <legend>
          <h2 ref={step === 0 ? heading : undefined} tabIndex={-1} className="mb-2 text-3xl text-lapis-deep outline-none">{t("tripTitle")}</h2>
        </legend>
        {types.length > 1 && (
          <div role="radiogroup" aria-label={t("bookingType")} className="grid grid-cols-2 gap-2">
            {types.map((ty) => (
              <label key={ty} className={cn("flex min-h-14 cursor-pointer flex-col justify-center rounded-sm border px-4 py-2", type === ty ? "border-lapis bg-lapis/5 ring-2 ring-lapis" : "border-field bg-white")}>
                <span className="flex items-center gap-2 font-semibold">
                  <input type="radio" value={ty} {...register("bookingType")} className="size-4 accent-[var(--color-lapis)]" data-testid={`book-type-${ty}`} />
                  {tt(ty)}
                </span>
                <span className={cn("pl-6 text-sm", type === ty ? "text-ink/80" : "text-ink-muted")}>{tt(ty === "group" ? "groupHint" : "privateHint")}</span>
              </label>
            ))}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="adults" label={tc("adults")} error={err("adults")} required>
            <Input type="number" inputMode="numeric" min={1} max={maxGroup} {...fieldAria("adults", err("adults"))} {...register("adults", { valueAsNumber: true })} />
          </Field>
          <Field id="children" label={tc("children")} error={err("children")}>
            <Input type="number" inputMode="numeric" min={0} max={maxGroup} {...fieldAria("children", err("children"))} {...register("children", { valueAsNumber: true })} />
          </Field>
        </div>
        {adults + children < minGroup && <p className="text-sm text-pomegranate">{tc("groupSize", { min: minGroup, max: maxGroup })}</p>}
        {useDepartures ? (
          <Field id="departureId" label={tt("departure")} error={err("departureId") ?? err("preferredDate")} required>
            <NativeSelect
              {...fieldAria("departureId", err("departureId") ?? err("preferredDate"))}
              value={departureId ? String(departureId) : ""}
              data-testid="book-departure"
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : undefined;
                setValue("departureId", id, { shouldValidate: true });
                setValue("preferredDate", depDate(id) ?? "", { shouldValidate: !!id });
              }}
            >
              <option value="">{tt("chooseDeparture")}</option>
              {bookableDeps.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDateLabel(d.startDate, ms)} – {formatDateLabel(d.endDate, ms)} · {tt("seatsLeft", { count: d.seatsTotal - d.seatsBooked })}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field id="preferredDate" label={t("date")} hint={t("dateHint")} error={err("preferredDate")} required>
            <Input type="date" min={minDate} {...fieldAria("preferredDate", err("preferredDate"), true)} {...register("preferredDate")} data-testid="book-date" />
          </Field>
        )}
        <QuoteBox testId="book" quote={quote} error={quoteError} adults={adults} childCount={children} />
      </fieldset>

      {/* Step 2 — traveller */}
      <fieldset hidden={step !== 1} className="flex flex-col gap-5">
        <legend>
          <h2 ref={step === 1 ? heading : undefined} tabIndex={-1} className="mb-2 text-3xl text-lapis-deep outline-none">{t("travellerTitle")}</h2>
        </legend>
        <Field id="fullName" label={t("fullName")} error={err("fullName")} required>
          <Input autoComplete="name" {...fieldAria("fullName", err("fullName"))} {...register("fullName")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="email" label={t("email")} error={err("email")} required>
            <Input type="email" autoComplete="email" {...fieldAria("email", err("email"))} {...register("email")} />
          </Field>
          <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={err("phone")} required>
            <Input type="tel" autoComplete="tel" {...fieldAria("phone", err("phone"), true)} {...register("phone")} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("contactChannel")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHANNELS.map((c) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-field bg-white px-3 has-[:checked]:border-lapis has-[:checked]:ring-2 has-[:checked]:ring-lapis">
                <input type="radio" value={c} {...register("contactChannel")} className="size-4 accent-[var(--color-lapis)]" />
                {t(`channels.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="messengerHandle" label={t("messengerHandle")} hint={t("messengerHint")} error={err("messengerHandle")}>
            <Input {...fieldAria("messengerHandle", err("messengerHandle"), true)} {...register("messengerHandle")} />
          </Field>
          <Field id="country" label={t("country")} error={err("country")}>
            <Input autoComplete="country-name" {...fieldAria("country", err("country"))} {...register("country")} />
          </Field>
        </div>
        <Field id="specialRequests" label={t("specialRequests")} hint={t("specialRequestsHint")} error={err("specialRequests")}>
          <Textarea {...fieldAria("specialRequests", err("specialRequests"), true)} {...register("specialRequests")} />
        </Field>
      </fieldset>

      {/* Step 3 — review */}
      <fieldset hidden={step !== 2} className="flex flex-col gap-5">
        <legend>
          <h2 ref={step === 2 ? heading : undefined} tabIndex={-1} className="mb-2 text-3xl text-lapis-deep outline-none">{t("reviewTitle")}</h2>
        </legend>
        <dl className="grid gap-4 rounded-sm bg-sand-soft p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">{t("summary")}</dt>
            <dd className="font-semibold">{tourTitle}</dd>
            <dd>{tt(values.bookingType)} · {values.preferredDate ? formatDateLabel(values.preferredDate, ms) : "—"}</dd>
            <dd>{tc("adultsCount", { count: adults || 0 })}, {tc("childrenCount", { count: children || 0 })}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t("traveller")}</dt>
            <dd className="font-semibold">{values.fullName}</dd>
            <dd className="break-all">{values.email}</dd>
            <dd>{values.phone} · {t(`channels.${values.contactChannel ?? "whatsapp"}`)}</dd>
          </div>
        </dl>
        <QuoteBox testId="review" quote={quote} error={quoteError} adults={adults} childCount={children} />
        <Turnstile ref={turnstile} locale={locale} error={err("turnstileToken")} onToken={(tok) => setValue("turnstileToken", tok, { shouldValidate: !!tok })} />
        <p className="text-sm text-ink-muted">{t("consent")} {t("privacyNote")}</p>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            ← {tc("back")}
          </Button>
        ) : (
          <span />
        )}
        {/* Separate keys: reusing one <button> would let the "Next" click land on the new submit button and send the booking. */}
        {step < 2 ? (
          <Button key="next" onClick={next} size="lg" data-testid="book-next">
            {tc("next")} →
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={formState.isSubmitting} data-testid="book-submit">
            {formState.isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" /> {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

function QuoteBox({ quote, error, adults, childCount, testId }: { quote: Priced | null; error: string | null; adults: number; childCount: number; testId: string }) {
  const tt = useTranslations("tour");
  const t = useTranslations("booking");
  const locale = useLocale() as Locale;
  return (
    <div className="rounded-sm border border-line bg-white p-4" aria-live="polite">
      {error ? (
        <p role="alert" className="font-semibold text-danger" data-testid={`${testId}-quote-error`}>{error}</p>
      ) : quote ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="text-sm text-ink-muted">
            <p>{tt("subtotalAdults", { count: adults, price: formatMoney(quote.perAdultMinor, quote.currency, locale) })}</p>
            {childCount > 0 && <p>{tt("subtotalChildren", { count: childCount, price: formatMoney(quote.perChildMinor, quote.currency, locale) })}</p>}
          </div>
          <p className="text-right">
            <span className="block text-sm text-ink-muted">{t("estimatedTotal")}</span>
            <span className="text-2xl font-bold text-lapis-deep" data-testid={`${testId}-total`}>{formatMoney(quote.totalMinor, quote.currency, locale)}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{tt("quoteUpdating")}</p>
      )}
    </div>
  );
}
