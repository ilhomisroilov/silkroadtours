"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldValues, type Path } from "react-hook-form";
import { z } from "zod";
import { Turnstile, type TurnstileHandle } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input, NativeSelect, Textarea } from "@/components/ui/form";
import type { ContactChannel, Locale } from "@/db/types";
import { apiFetch, translateCode } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { nightsBetween } from "@/lib/places/extras";
import { contactFields, futureDate, todayInTashkent } from "@/validators/common";

export type InquiryTopic = "hotel" | "restaurant" | "transport";

const CHANNELS: ContactChannel[] = ["whatsapp", "telegram", "phone", "email"];
const TIMES = ["12:00", "13:00", "14:00", "18:00", "19:00", "19:30", "20:00", "21:00"];
const optionalText = { setValueAs: (v: unknown) => (v === "" || v == null ? undefined : v) } as const;

const schemaFor = (topic: InquiryTopic) =>
  contactFields
    .extend({
      date: topic === "transport" ? futureDate.optional() : futureDate,
      endDate: futureDate.optional(),
      guests: z.number({ error: "invalid_field" }).int().min(1, { error: "invalid_field" }).max(100, { error: "invalid_field" }),
      rooms: z.number().int().min(1).max(30).optional(),
      roomType: z.string().max(120).optional(),
      time: z.string().max(10).optional(),
      message: z.string().trim().max(2000).optional(),
    })
    .refine((d) => topic !== "hotel" || (!!d.endDate && !!d.date && d.endDate > d.date), { error: "checkout_before_checkin", path: ["endDate"] });

/**
 * Request form for one hotel, restaurant or transport option. Sends a service request of type "inquiry"
 * (topic hotel | restaurant | transport) that our travel manager answers; it also becomes a CRM lead.
 */
export function PlaceInquiryForm({
  topic,
  refSlug,
  subject,
  roomTypes = [],
  defaults,
  summary,
  compact = true,
  idPrefix = "inq",
}: {
  topic: InquiryTopic;
  refSlug?: string;
  /** Sent as the request subject, e.g. "Hotel: Mulberry Courtyard House". */
  subject: string;
  roomTypes?: string[];
  defaults?: { date?: string; guests?: number; roomType?: string };
  /** Pre-filled details shown above the form and added to the request (transport: chosen departure). */
  summary?: string;
  compact?: boolean;
  idPrefix?: string;
}) {
  const t = useTranslations("placeCommon");
  const tb = useTranslations("booking");
  const te = useTranslations("errors");
  const tf = useTranslations("forms");
  const locale = useLocale() as Locale;
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const tomorrow = todayInTashkent(new Date(Date.now() + 86400_000));

  const form = useForm<FieldValues>({
    resolver: zodResolver(schemaFor(topic) as never),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      contactChannel: "whatsapp",
      messengerHandle: "",
      locale,
      turnstileToken: "",
      date: defaults?.date ?? "",
      endDate: undefined,
      guests: defaults?.guests ?? 2,
      rooms: 1,
      roomType: defaults?.roomType ?? "",
      time: "19:00",
      message: "",
    },
  });
  const { register, handleSubmit, formState, setValue, setError, reset, watch } = form;
  const defaultsKey = JSON.stringify(defaults ?? {});
  useEffect(() => {
    const d = JSON.parse(defaultsKey) as { date?: string; guests?: number; roomType?: string };
    if (d.date) setValue("date", d.date);
    if (d.guests) setValue("guests", d.guests);
    if (d.roomType) setValue("roomType", d.roomType);
  }, [defaultsKey, setValue]);

  const id = (name: string) => `${idPrefix}-${name}`;
  const err = (name: string) => {
    const m = (formState.errors as Record<string, { message?: unknown } | undefined>)[name]?.message;
    return m ? translateCode(String(m), te as never) : undefined;
  };
  const aria = (name: string, hint?: boolean) => ({ ...fieldAria(id(name), err(name), hint) });
  const nights = nightsBetween(watch("date"), watch("endDate"));

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const parts: string[] = [];
    if (summary) parts.push(summary);
    if (topic === "hotel") {
      parts.push(`Check-in ${v.date} · Check-out ${v.endDate} (${nightsBetween(v.date, v.endDate)} nights)`);
      parts.push(`${v.guests} guests · ${v.rooms ?? 1} room(s)${v.roomType ? ` · Room: ${v.roomType}` : ""}`);
    } else if (topic === "restaurant") {
      parts.push(`Table for ${v.guests} on ${v.date} at ${v.time ?? "—"}`);
    } else {
      parts.push(`${v.guests} passenger(s)${v.date ? ` · ${v.date}` : ""}`);
    }
    if (v.message) parts.push(`Message: ${v.message}`);
    const body: Record<string, unknown> = {
      type: "inquiry",
      topic,
      subject,
      refSlug,
      groupSize: v.guests,
      notes: parts.join("\n").slice(0, 3000),
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      contactChannel: v.contactChannel,
      locale,
      turnstileToken: v.turnstileToken,
    };
    if (!refSlug) delete body.refSlug;
    if (v.date) body.date = v.date;
    if (v.messengerHandle) body.messengerHandle = v.messengerHandle;
    const r = await apiFetch<{ reference: string }>("/api/service-requests", { method: "POST", json: body });
    if (r.ok) {
      setDone(r.data.reference);
      return;
    }
    turnstile.current?.reset();
    if (r.error.code === "network_error") return setFormError(tf("networkError"));
    const map: Record<string, string> = { groupSize: "guests", notes: "message" };
    for (const [path, codes] of Object.entries(r.error.fields ?? {})) {
      const key = path.split(".")[0]!;
      setError((map[key] ?? key) as Path<FieldValues>, { message: codes[0] });
    }
    setFormError(`${translateCode(r.error.code, te as never)} ${tf("keepInput")}`);
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-6" data-testid="inquiry-done">
        <CheckCircle2 aria-hidden="true" className="size-9 text-success" />
        <h3 className="text-2xl text-lapis-deep">{t("doneTitle")}</h3>
        <p>{t("doneText")}</p>
        <p className="text-sm text-ink-muted">{t("doneReference")}</p>
        <p className="font-display text-2xl font-bold text-lapis" data-testid="inquiry-reference">{done}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            setDone(null);
          }}
        >
          {t("another")}
        </Button>
      </div>
    );
  }

  const pair = compact ? "grid grid-cols-2 gap-3" : "grid gap-4 sm:grid-cols-2";
  const guestsLabel = topic === "transport" ? t("passengers") : t("guests");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" data-testid={`inquiry-form-${topic}`}>
      {formError && (
        <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-3 text-sm font-semibold text-danger">
          {formError}
        </div>
      )}
      {summary && <p className="whitespace-pre-line rounded-xl bg-sky px-4 py-3 text-sm font-semibold text-lapis-deep">{summary}</p>}

      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">{t("requestDetails")}</legend>
        {topic === "hotel" && (
          <>
            <div className={pair}>
              <Field id={id("date")} label={t("checkIn")} error={err("date")} required>
                <Input type="date" min={tomorrow} {...aria("date")} {...register("date", optionalText)} />
              </Field>
              <Field id={id("endDate")} label={t("checkOut")} error={err("endDate")} required>
                <Input type="date" min={tomorrow} {...aria("endDate")} {...register("endDate", optionalText)} />
              </Field>
            </div>
            {nights > 0 && <p className="-mt-2 text-sm text-ink-muted">{t("nights", { count: nights })}</p>}
            <div className={pair}>
              <Field id={id("guests")} label={guestsLabel} error={err("guests")} required>
                <Input type="number" inputMode="numeric" min={1} max={100} {...aria("guests")} {...register("guests", { valueAsNumber: true })} />
              </Field>
              <Field id={id("rooms")} label={t("rooms")} error={err("rooms")}>
                <Input type="number" inputMode="numeric" min={1} max={30} {...aria("rooms")} {...register("rooms", { setValueAs: (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)) })} />
              </Field>
            </div>
            {roomTypes.length > 0 && (
              <Field id={id("roomType")} label={t("roomType")} error={err("roomType")}>
                <NativeSelect {...aria("roomType")} {...register("roomType")}>
                  <option value="">{t("anyRoom")}</option>
                  {roomTypes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </>
        )}
        {topic === "restaurant" && (
          <>
            <div className={pair}>
              <Field id={id("date")} label={t("date")} error={err("date")} required>
                <Input type="date" min={tomorrow} {...aria("date")} {...register("date", optionalText)} />
              </Field>
              <Field id={id("time")} label={t("time")} error={err("time")}>
                <NativeSelect {...aria("time")} {...register("time")}>
                  {TIMES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field id={id("guests")} label={guestsLabel} error={err("guests")} required>
              <Input type="number" inputMode="numeric" min={1} max={100} {...aria("guests")} {...register("guests", { valueAsNumber: true })} />
            </Field>
          </>
        )}
        {topic === "transport" && (
          <div className={pair}>
            <Field id={id("date")} label={t("date")} error={err("date")}>
              <Input type="date" min={tomorrow} {...aria("date")} {...register("date", optionalText)} />
            </Field>
            <Field id={id("guests")} label={guestsLabel} error={err("guests")} required>
              <Input type="number" inputMode="numeric" min={1} max={100} {...aria("guests")} {...register("guests", { valueAsNumber: true })} />
            </Field>
          </div>
        )}
        <Field id={id("message")} label={t("message")} hint={t("messageHint")} error={err("message")}>
          <Textarea rows={3} className="min-h-20" {...aria("message", true)} {...register("message")} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-bold text-lapis-deep">{t("contactTitle")}</legend>
        <Field id={id("fullName")} label={tb("fullName")} error={err("fullName")} required>
          <Input autoComplete="name" {...aria("fullName")} {...register("fullName")} />
        </Field>
        <Field id={id("email")} label={tb("email")} error={err("email")} required>
          <Input type="email" autoComplete="email" {...aria("email")} {...register("email")} />
        </Field>
        <Field id={id("phone")} label={tb("phone")} hint={tb("phoneHint")} error={err("phone")} required>
          <Input type="tel" autoComplete="tel" {...aria("phone", true)} {...register("phone")} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{tb("contactChannel")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((c) => (
              <label
                key={c}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-field bg-white px-3 text-sm has-[:checked]:border-lapis has-[:checked]:ring-2 has-[:checked]:ring-lapis"
              >
                <input type="radio" value={c} {...register("contactChannel")} className="size-4 accent-[var(--color-lapis)]" />
                {tb(`channels.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Turnstile ref={turnstile} locale={locale} error={err("turnstileToken")} onToken={(tok) => setValue("turnstileToken", tok, { shouldValidate: !!tok })} />
        <p className="text-sm text-ink-muted">{t("consent")}</p>
      </fieldset>

      <Button type="submit" size="lg" className={cn("w-full")} disabled={formState.isSubmitting} data-testid="inquiry-submit">
        {formState.isSubmitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" /> {tb("submitting")}
          </>
        ) : (
          t(`submit.${topic}`)
        )}
      </Button>
    </form>
  );
}
