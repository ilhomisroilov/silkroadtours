"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldValues, type Path } from "react-hook-form";
import type { ZodType } from "zod";
import type { ContactChannel, Locale } from "@/db/types";
import { apiFetch, translateCode } from "@/lib/client/api";
import { todayInTashkent } from "@/validators/common";
import {
  ACCOMMODATION_LEVELS,
  AIRPORTS,
  GUIDE_LANGUAGES,
  INTERESTS,
  serviceRequestSchemas,
  VEHICLE_CLASSES,
} from "@/validators/service-request";
import { Turnstile, type TurnstileHandle } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input, NativeSelect, Textarea } from "@/components/ui/form";

export type ServiceKind = "airport-transfer" | "tailor-made" | "accommodation" | "guides" | "inquiry";
export type InquiryContext = { topic: "experience" | "service" | "general"; subject?: string; refSlug?: string };

const CONFIG: Record<ServiceKind, { type: string; schema: ZodType<FieldValues, FieldValues> }> = {
  "airport-transfer": { type: "airport_transfer", schema: serviceRequestSchemas.airportTransfer as never },
  "tailor-made": { type: "custom_tour", schema: serviceRequestSchemas.customTour as never },
  accommodation: { type: "accommodation", schema: serviceRequestSchemas.accommodation as never },
  guides: { type: "guide", schema: serviceRequestSchemas.guide as never },
  inquiry: { type: "inquiry", schema: serviceRequestSchemas.inquiry as never },
};
const optionalNumber = { setValueAs: (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)) } as const;
const optionalText = { setValueAs: (v: unknown) => (v === "" || v == null ? undefined : v) } as const;
const CHANNELS: ContactChannel[] = ["whatsapp", "telegram", "phone", "email"];

export function ServiceRequestForm({
  kind,
  destinations,
  inquiry,
  preset,
  hideDetails = false,
  title,
  submitLabel,
  compact = false,
}: {
  kind: ServiceKind;
  destinations: { slug: string; name: string }[];
  /** For kind "inquiry": what the question is about. A given subject is sent as is and not shown as a field. */
  inquiry?: InquiryContext;
  /** Values filled in by the page (for example by the tour builder); kept in sync while the form is open. */
  preset?: Record<string, unknown>;
  /** Hide the request details and send only the contact step (details come from `preset`). */
  hideDetails?: boolean;
  title?: string;
  submitLabel?: string;
  /** Narrow layout for sidebars: one column, smaller headings. */
  compact?: boolean;
}) {
  const t = useTranslations("services");
  const tb = useTranslations("booking");
  const te = useTranslations("errors");
  const tf = useTranslations("forms");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const { type, schema } = CONFIG[kind];
  const tomorrow = todayInTashkent(new Date(Date.now() + 86400_000));

  const defaults: Record<ServiceKind, Record<string, unknown>> = {
    "airport-transfer": { airport: "TAS", direction: "arrival", flightNumber: "", date: "", time: "", passengers: 2, luggage: 2, address: "", vehicleClass: "sedan", notes: "" },
    "tailor-made": { startDate: "", endDate: "", adults: 2, children: 0, destinationSlugs: [], interests: [], accommodationLevel: "comfort", notes: "" },
    accommodation: { kind: "hotel", destinationSlug: destinations[0]?.slug ?? "", checkIn: "", checkOut: "", rooms: 1, guests: 2, level: "comfort", notes: "" },
    guides: { language: locale === "ru" ? "ru" : "en", destinationSlug: destinations[0]?.slug ?? "", date: "", days: 1, groupSize: 2, notes: "" },
    inquiry: { topic: inquiry?.topic ?? "general", subject: inquiry?.subject ?? "", refSlug: inquiry?.refSlug, date: undefined, groupSize: undefined, notes: "" },
  };

  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never),
    mode: "onTouched",
    defaultValues: {
      type,
      fullName: "",
      email: "",
      phone: "",
      contactChannel: "whatsapp",
      messengerHandle: "",
      locale,
      turnstileToken: "",
      ...defaults[kind],
      ...preset,
    },
  });
  const { register, handleSubmit, formState, setValue, setError, reset } = form;
  const presetKey = JSON.stringify(preset ?? {});
  useEffect(() => {
    for (const [k, v] of Object.entries(JSON.parse(presetKey) as Record<string, unknown>)) setValue(k, v);
  }, [presetKey, setValue]);
  const err = (name: string) => {
    const m = (formState.errors as Record<string, { message?: unknown } | undefined>)[name]?.message;
    return m ? translateCode(String(m), te as never) : undefined;
  };
  const num = { valueAsNumber: true } as const;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body = { ...values };
    for (const k of ["flightNumber", "notes", "messengerHandle", "date", "refSlug"]) if (body[k] === "" || body[k] === undefined) delete body[k];
    if (body.groupSize === undefined || Number.isNaN(body.groupSize)) delete body.groupSize;
    if (body.budgetPerPersonUsd === "" || Number.isNaN(body.budgetPerPersonUsd)) delete body.budgetPerPersonUsd;
    const r = await apiFetch<{ reference: string }>("/api/service-requests", { method: "POST", json: body });
    if (r.ok) {
      setDone(r.data.reference);
      if (!compact && !hideDetails) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    turnstile.current?.reset();
    if (r.error.code === "network_error") return setFormError(tf("networkError"));
    for (const [path, codes] of Object.entries(r.error.fields ?? {})) setError(path.split(".")[0] as Path<FieldValues>, { message: codes[0] });
    setFormError(`${translateCode(r.error.code, te as never)} ${tf("keepInput")}`);
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-8" data-testid="service-done">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h2 className={compact ? "text-2xl text-lapis" : "text-3xl text-lapis-deep"}>{t("doneTitle")}</h2>
        <p className="text-lg">
          {t("doneText", { reference: done })}
        </p>
        <p className={compact ? "text-2xl font-extrabold text-lapis" : "font-display text-4xl font-bold text-lapis-deep"} data-testid="service-reference">{done}</p>
        <Button variant="outline" onClick={() => { reset(); setDone(null); }}>{t("another")}</Button>
      </div>
    );
  }

  const legendCls = compact || hideDetails ? "mb-2 text-xl font-bold text-lapis" : "mb-2 font-display text-3xl font-semibold text-lapis-deep";
  const pair = compact ? "grid gap-4" : "grid gap-5 sm:grid-cols-2";
  const dest = destinations.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>);

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? "flex flex-col gap-6" : "flex flex-col gap-8"} data-testid={`service-form-${kind}`}>
      {formError && <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-4 font-semibold text-danger">{formError}</div>}
      {!hideDetails && (
      <fieldset className="flex flex-col gap-5">
        <legend className={legendCls}>{title ?? t("requestTitle")}</legend>

        {kind === "inquiry" && (
          <>
            {!inquiry?.subject && (
              <Field id="subject" label={t("subject")} error={err("subject")} required>
                <Input {...fieldAria("subject", err("subject"))} {...register("subject")} />
              </Field>
            )}
            <div className={pair}>
              <Field id="date" label={t("preferredDate")} error={err("date")}>
                <Input type="date" min={tomorrow} {...fieldAria("date", err("date"))} {...register("date", optionalText)} />
              </Field>
              <Field id="groupSize" label={t("travellers")} error={err("groupSize")}>
                <Input type="number" min={1} max={100} {...fieldAria("groupSize", err("groupSize"))} {...register("groupSize", optionalNumber)} />
              </Field>
            </div>
          </>
        )}

        {kind === "airport-transfer" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="airport" label={t("airport")} error={err("airport")} required>
                <NativeSelect {...fieldAria("airport", err("airport"))} {...register("airport")}>
                  {AIRPORTS.map((a) => <option key={a} value={a}>{t(`airports.${a}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field id="direction" label={t("direction")} error={err("direction")} required>
                <NativeSelect {...fieldAria("direction", err("direction"))} {...register("direction")}>
                  {(["arrival", "departure", "round_trip"] as const).map((d) => <option key={d} value={d}>{t(`directions.${d}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field id="date" label={t("date")} error={err("date")} required>
                <Input type="date" min={tomorrow} {...fieldAria("date", err("date"))} {...register("date")} />
              </Field>
              <Field id="time" label={t("time")} error={err("time")} required>
                <Input type="time" {...fieldAria("time", err("time"))} {...register("time")} />
              </Field>
              <Field id="flightNumber" label={t("flightNumber")} error={err("flightNumber")}>
                <Input {...fieldAria("flightNumber", err("flightNumber"))} {...register("flightNumber")} placeholder="HY 602" />
              </Field>
              <Field id="vehicleClass" label={t("vehicleClass")} error={err("vehicleClass")} required>
                <NativeSelect {...fieldAria("vehicleClass", err("vehicleClass"))} {...register("vehicleClass")}>
                  {VEHICLE_CLASSES.map((v) => <option key={v} value={v}>{t(`vehicles.${v}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field id="passengers" label={t("passengers")} error={err("passengers")} required>
                <Input type="number" min={1} max={50} {...fieldAria("passengers", err("passengers"))} {...register("passengers", num)} />
              </Field>
              <Field id="luggage" label={t("luggage")} error={err("luggage")} required>
                <Input type="number" min={0} max={100} {...fieldAria("luggage", err("luggage"))} {...register("luggage", num)} />
              </Field>
            </div>
            <Field id="address" label={t("address")} error={err("address")} required>
              <Input {...fieldAria("address", err("address"))} {...register("address")} />
            </Field>
          </>
        )}

        {kind === "tailor-made" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="startDate" label={t("startDate")} error={err("startDate")} required>
                <Input type="date" min={tomorrow} {...fieldAria("startDate", err("startDate"))} {...register("startDate")} />
              </Field>
              <Field id="endDate" label={t("endDate")} error={err("endDate")} required>
                <Input type="date" min={tomorrow} {...fieldAria("endDate", err("endDate"))} {...register("endDate")} />
              </Field>
              <Field id="adults" label={tc("adults")} error={err("adults")} required>
                <Input type="number" min={1} max={60} {...fieldAria("adults", err("adults"))} {...register("adults", num)} />
              </Field>
              <Field id="children" label={tc("children")} error={err("children")}>
                <Input type="number" min={0} max={40} {...fieldAria("children", err("children"))} {...register("children", num)} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("destinationsPick")} <span aria-hidden="true" className="text-pomegranate">*</span></legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {destinations.map((d) => (
                  <label key={d.slug} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-field bg-white px-3 has-[:checked]:border-lapis has-[:checked]:ring-2 has-[:checked]:ring-lapis">
                    <input type="checkbox" value={d.slug} {...register("destinationSlugs")} className="size-4 accent-[var(--color-lapis)]" />
                    {d.name}
                  </label>
                ))}
              </div>
              {err("destinationSlugs") && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{t("chooseAtLeastOne")}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("interests")}</legend>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <label key={i} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-field bg-white px-4 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5">
                    <input type="checkbox" value={i} {...register("interests")} className="size-4 accent-[var(--color-terracotta)]" />
                    {t(`interestOptions.${i}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="accommodationLevel" label={t("accommodationLevel")} error={err("accommodationLevel")} required>
                <NativeSelect {...fieldAria("accommodationLevel", err("accommodationLevel"))} {...register("accommodationLevel")}>
                  {ACCOMMODATION_LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field id="budgetPerPersonUsd" label={t("budget")} error={err("budgetPerPersonUsd")}>
                <Input type="number" min={0} {...fieldAria("budgetPerPersonUsd", err("budgetPerPersonUsd"))} {...register("budgetPerPersonUsd", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })} />
              </Field>
            </div>
          </>
        )}

        {kind === "accommodation" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="kind" label={t("kind")} error={err("kind")} required>
              <NativeSelect {...fieldAria("kind", err("kind"))} {...register("kind")}>
                {(["hotel", "yurt_camp", "guesthouse"] as const).map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field id="destinationSlug" label={t("destination")} error={err("destinationSlug")} required>
              <NativeSelect {...fieldAria("destinationSlug", err("destinationSlug"))} {...register("destinationSlug")}>{dest}</NativeSelect>
            </Field>
            <Field id="checkIn" label={t("checkIn")} error={err("checkIn")} required>
              <Input type="date" min={tomorrow} {...fieldAria("checkIn", err("checkIn"))} {...register("checkIn")} />
            </Field>
            <Field id="checkOut" label={t("checkOut")} error={err("checkOut")} required>
              <Input type="date" min={tomorrow} {...fieldAria("checkOut", err("checkOut"))} {...register("checkOut")} />
            </Field>
            <Field id="rooms" label={t("rooms")} error={err("rooms")} required>
              <Input type="number" min={1} max={30} {...fieldAria("rooms", err("rooms"))} {...register("rooms", num)} />
            </Field>
            <Field id="guests" label={t("guests")} error={err("guests")} required>
              <Input type="number" min={1} max={100} {...fieldAria("guests", err("guests"))} {...register("guests", num)} />
            </Field>
            <Field id="level" label={t("accommodationLevel")} error={err("level")} required>
              <NativeSelect {...fieldAria("level", err("level"))} {...register("level")}>
                {ACCOMMODATION_LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
              </NativeSelect>
            </Field>
          </div>
        )}

        {kind === "guides" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="language" label={t("language")} error={err("language")} required>
              <NativeSelect {...fieldAria("language", err("language"))} {...register("language")}>
                {GUIDE_LANGUAGES.map((l) => <option key={l} value={l}>{t(`guideLanguages.${l}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field id="destinationSlug" label={t("destination")} error={err("destinationSlug")} required>
              <NativeSelect {...fieldAria("destinationSlug", err("destinationSlug"))} {...register("destinationSlug")}>{dest}</NativeSelect>
            </Field>
            <Field id="date" label={t("date")} error={err("date")} required>
              <Input type="date" min={tomorrow} {...fieldAria("date", err("date"))} {...register("date")} />
            </Field>
            <Field id="days" label={t("days")} error={err("days")} required>
              <Input type="number" min={1} max={30} {...fieldAria("days", err("days"))} {...register("days", num)} />
            </Field>
            <Field id="groupSize" label={t("groupSize")} error={err("groupSize")} required>
              <Input type="number" min={1} max={60} {...fieldAria("groupSize", err("groupSize"))} {...register("groupSize", num)} />
            </Field>
          </div>
        )}

        <Field id="notes" label={kind === "inquiry" ? t("message") : t("notes")} error={err("notes")} required={kind === "inquiry"}>
          <Textarea {...fieldAria("notes", err("notes"))} {...register("notes")} />
        </Field>
      </fieldset>
      )}

      <fieldset className="flex flex-col gap-5">
        <legend className={legendCls}>{hideDetails && title ? title : t("contactTitle")}</legend>
        <Field id="fullName" label={tb("fullName")} error={err("fullName")} required>
          <Input autoComplete="name" {...fieldAria("fullName", err("fullName"))} {...register("fullName")} />
        </Field>
        <div className={pair}>
          <Field id="email" label={tb("email")} error={err("email")} required>
            <Input type="email" autoComplete="email" {...fieldAria("email", err("email"))} {...register("email")} />
          </Field>
          <Field id="phone" label={tb("phone")} hint={tb("phoneHint")} error={err("phone")} required>
            <Input type="tel" autoComplete="tel" {...fieldAria("phone", err("phone"), true)} {...register("phone")} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{tb("contactChannel")}</legend>
          <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}>
            {CHANNELS.map((c) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-field bg-white px-3 has-[:checked]:border-lapis has-[:checked]:ring-2 has-[:checked]:ring-lapis">
                <input type="radio" value={c} {...register("contactChannel")} className="size-4 accent-[var(--color-lapis)]" />
                {tb(`channels.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="messengerHandle" label={tb("messengerHandle")} hint={tb("messengerHint")} error={err("messengerHandle")}>
          <Input {...fieldAria("messengerHandle", err("messengerHandle"), true)} {...register("messengerHandle")} />
        </Field>
        <Turnstile ref={turnstile} locale={locale} error={err("turnstileToken")} onToken={(tok) => setValue("turnstileToken", tok, { shouldValidate: !!tok })} />
        <p className="text-sm text-ink-muted">{tb("consent")}</p>
      </fieldset>

      <Button type="submit" size="lg" className={compact ? "w-full" : "self-start"} disabled={formState.isSubmitting} data-testid="service-submit">
        {formState.isSubmitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" /> {tb("submitting")}
          </>
        ) : (
          submitLabel ?? t("submit")
        )}
      </Button>
    </form>
  );
}
