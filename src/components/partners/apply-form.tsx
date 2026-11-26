"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, type Path } from "react-hook-form";
import type { z } from "zod";
import { CopyButton } from "@/components/common/copy-button";
import { Turnstile, type TurnstileHandle } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input, NativeSelect, Textarea } from "@/components/ui/form";
import type { Locale, PartnerType } from "@/db/types";
import { getPathname, Link } from "@/i18n/navigation";
import { apiFetch, translateCode } from "@/lib/client/api";
import { PARTNER_TYPE_LIST, SERVICE_UNITS, type PartnerService } from "@/lib/partners";
import { partnerApplicationSchema } from "@/validators/partner";
import { emptyService, ServicesEditor, type ServicesEditorLabels } from "./services-editor";

type FormInput = z.input<typeof partnerApplicationSchema>;

/** Translates a validation/API code: partner-specific texts first, then the shared error dictionary. */
export function usePartnerErrorText() {
  const tp = useTranslations("partnersPage");
  const te = useTranslations("errors");
  return (code: string | undefined) => {
    if (!code) return undefined;
    if (tp.has(`errors.${code}` as never)) return tp(`errors.${code}` as never);
    return translateCode(code, te as never);
  };
}

export function useServicesLabels(): ServicesEditorLabels {
  const t = useTranslations("partnersPage");
  return {
    serviceName: t("apply.serviceName"),
    placeholder: t("apply.servicePlaceholder"),
    price: t("apply.price"),
    unit: t("apply.unit"),
    noUnit: t("apply.noUnit"),
    add: t("apply.addService"),
    remove: (n) => t("apply.removeService", { n }),
    serviceN: (n) => t("apply.serviceN", { n }),
    units: Object.fromEntries(SERVICE_UNITS.map((u) => [u, t(`unitNames.${u}`)])) as ServicesEditorLabels["units"],
  };
}

export function PartnerApplyForm({ destinations, initialType }: { destinations: { slug: string; name: string }[]; initialType?: PartnerType }) {
  const t = useTranslations("partnersPage");
  const tf = useTranslations("forms");
  const locale = useLocale() as Locale;
  const errText = usePartnerErrorText();
  const labels = useServicesLabels();
  const turnstile = useRef<TurnstileHandle>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; token: string } | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(partnerApplicationSchema, undefined, { raw: true }),
    mode: "onTouched",
    defaultValues: {
      type: initialType ?? "hotel",
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      destinationSlug: "",
      city: "",
      description: "",
      services: [emptyService()],
      locale,
      consent: false as unknown as true,
      turnstileToken: "",
    },
  });
  const { register, handleSubmit, formState, setValue, setError, watch, getValues } = form;
  const services = watch("services") as PartnerService[];
  const errors = formState.errors as Record<string, { message?: string } | undefined> & {
    services?: { message?: string; root?: { message?: string } } & Record<number, { name?: { message?: string } } | undefined>;
  };
  const err = (name: string) => errText(errors[name]?.message);
  const rowErrors: Record<number, string | undefined> = {};
  services.forEach((_, i) => (rowErrors[i] = errText(errors.services?.[i]?.name?.message)));
  const servicesError = errText(errors.services?.message ?? errors.services?.root?.message);

  const destinationSlug = watch("destinationSlug");
  useEffect(() => {
    const d = destinations.find((x) => x.slug === destinationSlug);
    if (d && !getValues("city")) setValue("city", d.name, { shouldValidate: formState.isSubmitted });
  }, [destinationSlug, destinations, getValues, setValue, formState.isSubmitted]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body = {
      ...values,
      services: (values.services as PartnerService[]).map((s) => ({ ...s, name: s.name.trim() })),
    };
    const r = await apiFetch<{ reference: string; token: string }>("/api/partners", { method: "POST", json: body });
    if (r.ok) {
      setDone(r.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    turnstile.current?.reset();
    if (r.error.code === "network_error") return setFormError(tf("networkError"));
    for (const [path, codes] of Object.entries(r.error.fields ?? {})) setError(path as Path<FormInput>, { message: codes[0] });
    setFormError(`${errText(r.error.code)} ${tf("keepInput")}`);
  });

  if (done) {
    const query = { ref: done.reference, token: done.token };
    const path = getPathname({ locale, href: { pathname: "/partners/dashboard", query } });
    const absolute = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    return (
      <div role="status" className="flex flex-col gap-6" data-testid="partner-apply-done">
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-6 sm:p-8">
          <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
          <h2 className="text-3xl text-lapis-deep">{t("apply.doneTitle")}</h2>
          <p className="text-lg">{t("apply.doneText", { reference: done.reference })}</p>
          <p className="font-display text-4xl font-bold tracking-[0.04em] text-lapis-deep" data-testid="partner-reference">{done.reference}</p>
        </div>
        <div className="bg-girih-dark on-dark rounded-[var(--radius-card)] p-6 text-white sm:p-8">
          <h3 className="text-2xl text-white">{t("apply.dashboardTitle")}</h3>
          <p className="mt-2 text-white/80">{t("apply.dashboardText")}</p>
          <p className="mt-4 break-all rounded-sm bg-white/10 p-3 font-mono text-sm text-sand">{absolute}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={{ pathname: "/partners/dashboard", query }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron px-5 font-bold text-lapis-deep hover:bg-[#e6b55a]" data-testid="partner-dashboard-link">
              {t("apply.openDashboard")} <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
            <CopyButton value={absolute} label={t("apply.copy")} copiedLabel={t("apply.copied")} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-10" data-testid="partner-apply-form">
      {formError && <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-4 font-semibold text-danger">{formError}</div>}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-display text-2xl font-extrabold text-lapis-deep">{t("apply.sectionBusiness")}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="type" label={t("apply.type")} error={err("type")} required>
            <NativeSelect {...fieldAria("type", err("type"))} {...register("type")}>
              {PARTNER_TYPE_LIST.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field id="businessName" label={t("apply.businessName")} error={err("businessName")} required>
            <Input autoComplete="organization" {...fieldAria("businessName", err("businessName"))} {...register("businessName")} />
          </Field>
          <Field id="destinationSlug" label={t("apply.destination")} error={err("destinationSlug")}>
            <NativeSelect {...fieldAria("destinationSlug", err("destinationSlug"))} {...register("destinationSlug")}>
              <option value="">{t("apply.destinationOther")}</option>
              {destinations.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </NativeSelect>
          </Field>
          <Field id="city" label={t("apply.city")} error={err("city")} required>
            <Input autoComplete="address-level2" {...fieldAria("city", err("city"))} {...register("city")} />
          </Field>
          <Field id="website" label={t("apply.website")} hint={t("apply.websiteHint")} error={err("website")} className="sm:col-span-2">
            <Input type="url" inputMode="url" autoComplete="url" {...fieldAria("website", err("website"), true)} {...register("website")} />
          </Field>
        </div>
        <Field id="description" label={t("apply.description")} hint={t("apply.descriptionHint")} error={err("description")} required>
          <Textarea rows={5} maxLength={2000} {...fieldAria("description", err("description"), true)} {...register("description")} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold text-lapis-deep">{t("apply.sectionServices")}</legend>
        <p className="-mt-2 text-sm text-ink-muted">{t("apply.servicesHint")}</p>
        <ServicesEditor
          value={services}
          onChange={(next) => setValue("services", next, { shouldValidate: formState.isSubmitted })}
          labels={labels}
          errors={rowErrors}
        />
        {servicesError && <p role="alert" className="text-sm font-semibold text-danger">{servicesError}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-display text-2xl font-extrabold text-lapis-deep">{t("apply.sectionContact")}</legend>
        <Field id="contactName" label={t("apply.contactName")} error={err("contactName")} required>
          <Input autoComplete="name" {...fieldAria("contactName", err("contactName"))} {...register("contactName")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="email" label={t("apply.email")} error={err("email")} required>
            <Input type="email" autoComplete="email" {...fieldAria("email", err("email"))} {...register("email")} />
          </Field>
          <Field id="phone" label={t("apply.phone")} hint={t("apply.phoneHint")} error={err("phone")} required>
            <Input type="tel" autoComplete="tel" {...fieldAria("phone", err("phone"), true)} {...register("phone")} />
          </Field>
        </div>
        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-field bg-white p-4 has-[:checked]:border-lapis">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-[var(--color-lapis)]"
              aria-invalid={err("consent") ? true : undefined}
              aria-describedby={err("consent") ? "consent-error" : undefined}
              data-testid="partner-consent"
              {...register("consent")}
            />
            <span className="text-sm">{t("apply.consent")}</span>
          </label>
          {err("consent") && <p id="consent-error" role="alert" className="mt-1.5 text-sm font-semibold text-danger">{err("consent")}</p>}
        </div>
        <Turnstile ref={turnstile} locale={locale} error={err("turnstileToken")} onToken={(tok) => setValue("turnstileToken", tok, { shouldValidate: !!tok })} />
      </fieldset>

      <Button type="submit" size="lg" className="self-start" disabled={formState.isSubmitting} data-testid="partner-apply-submit">
        {formState.isSubmitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" /> {t("apply.submitting")}
          </>
        ) : (
          t("apply.submit")
        )}
      </Button>
    </form>
  );
}
