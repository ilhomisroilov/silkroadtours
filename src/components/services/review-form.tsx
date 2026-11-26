"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm, type FieldValues, type Path } from "react-hook-form";
import type { Locale } from "@/db/types";
import { apiFetch, translateCode } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { reviewSubmitSchema } from "@/validators/public";
import { Turnstile, type TurnstileHandle } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input, Textarea } from "@/components/ui/form";

/** Guests review a completed trip using their booking reference and email (POST /api/reviews). */
export function ReviewForm({ initialReference }: { initialReference?: string }) {
  const t = useTranslations("reviewForm");
  const te = useTranslations("errors");
  const tf = useTranslations("forms");
  const locale = useLocale() as Locale;
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const { register, handleSubmit, formState, setValue, setError, watch } = useForm<FieldValues>({
    resolver: zodResolver(reviewSubmitSchema as never),
    mode: "onTouched",
    defaultValues: { reference: initialReference ?? "", email: "", authorName: "", authorCountry: "", rating: 0, title: "", body: "", language: locale, turnstileToken: "" },
  });
  const rating = Number(watch("rating"));
  const err = (name: string) => {
    const m = (formState.errors as Record<string, { message?: unknown } | undefined>)[name]?.message;
    return m ? translateCode(String(m), te as never) : undefined;
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body: Record<string, unknown> = { ...values, reference: String(values.reference).toUpperCase() };
    for (const k of ["authorName", "authorCountry", "title"]) if (body[k] === "") delete body[k];
    const r = await apiFetch("/api/reviews", { method: "POST", json: body });
    if (r.ok) return setDone(true);
    turnstile.current?.reset();
    if (r.error.code === "network_error") return setFormError(tf("networkError"));
    for (const [path, codes] of Object.entries(r.error.fields ?? {})) setError(path as Path<FieldValues>, { message: codes[0] });
    setFormError(translateCode(r.error.code, te as never));
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-8">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <h2 className="text-3xl text-lapis-deep">{t("doneTitle")}</h2>
        <p className="text-lg">{t("doneText")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-4 font-semibold text-danger">{formError}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="reference" label={t("reference")} hint={t("referenceHint")} error={err("reference")} required>
          <Input autoCapitalize="characters" {...fieldAria("reference", err("reference"), true)} {...register("reference", { setValueAs: (v: string) => v.trim().toUpperCase() })} />
        </Field>
        <Field id="email" label={t("email")} error={err("email")} required>
          <Input type="email" autoComplete="email" {...fieldAria("email", err("email"))} {...register("email")} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("rating")} <span aria-hidden="true" className="text-pomegranate">*</span></legend>
        <div className="flex gap-1" role="radiogroup" aria-label={t("rating")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" value={n} className="peer sr-only" {...register("rating", { valueAsNumber: true })} />
              <span className="inline-flex size-11 items-center justify-center rounded-full peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-cobalt">
                <Star aria-hidden="true" className={cn("size-8", n <= rating ? "fill-saffron text-saffron" : "text-field")} />
              </span>
              <span className="sr-only">{t("stars", { count: n })}</span>
            </label>
          ))}
        </div>
        {err("rating") && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{err("rating")}</p>}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="authorName" label={t("name")} hint={t("nameHint")} error={err("authorName")}>
          <Input {...fieldAria("authorName", err("authorName"), true)} {...register("authorName")} />
        </Field>
        <Field id="authorCountry" label={t("country")} error={err("authorCountry")}>
          <Input {...fieldAria("authorCountry", err("authorCountry"))} {...register("authorCountry")} />
        </Field>
      </div>
      <Field id="title" label={t("reviewTitle")} error={err("title")}>
        <Input {...fieldAria("title", err("title"))} {...register("title")} />
      </Field>
      <Field id="body" label={t("body")} hint={t("bodyHint")} error={err("body")} required>
        <Textarea rows={6} {...fieldAria("body", err("body"), true)} {...register("body")} />
      </Field>
      <Turnstile ref={turnstile} locale={locale} error={err("turnstileToken")} onToken={(tok) => setValue("turnstileToken", tok, { shouldValidate: !!tok })} />
      <Button type="submit" size="lg" className="self-start" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
