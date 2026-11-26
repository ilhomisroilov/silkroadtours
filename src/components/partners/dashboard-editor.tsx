"use client";

import { Loader2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Textarea } from "@/components/ui/form";
import { apiFetch } from "@/lib/client/api";
import type { PartnerService } from "@/lib/partners";
import { usePartnerErrorText, useServicesLabels } from "./apply-form";
import { ServicesEditor } from "./services-editor";

/** Lets a partner update the description and services while the application is pending. */
export function PartnerDashboardEditor({
  reference,
  token,
  description,
  services,
}: {
  reference: string;
  token: string;
  description: string;
  services: PartnerService[];
}) {
  const t = useTranslations("partnersPage");
  const errText = usePartnerErrorText();
  const labels = useServicesLabels();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState(description);
  const [list, setList] = useState<PartnerService[]>(services.length ? services : [{ name: "", priceFromUsd: null, unit: null }]);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        {message?.tone === "ok" && <p role="status" className="text-sm font-semibold text-success">{message.text}</p>}
        <Button variant="outline" size="sm" onClick={() => { setOpen(true); setMessage(null); }} data-testid="partner-edit">
          <Pencil aria-hidden="true" /> {t("dashboard.edit")}
        </Button>
      </div>
    );
  }

  const rowErrors: Record<number, string | undefined> = {};
  for (const [k, v] of Object.entries(fields)) {
    const m = /^services\.(\d+)\.name$/.exec(k);
    if (m) rowErrors[Number(m[1])] = v;
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-[1.25rem] border border-lapis/20 bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        const r = await apiFetch("/api/partners/dashboard", {
          method: "PATCH",
          json: { reference, token, description: desc, services: list.map((s) => ({ ...s, name: s.name.trim() })) },
        });
        setBusy(false);
        if (r.ok) {
          setFields({});
          setOpen(false);
          setMessage({ tone: "ok", text: t("dashboard.saved") });
          router.refresh();
          return;
        }
        const f: Record<string, string> = {};
        for (const [path, codes] of Object.entries(r.error.fields ?? {})) f[path] = errText(codes[0]) ?? "";
        setFields(f);
        setMessage({ tone: "error", text: errText(r.error.code) ?? "" });
      }}
      data-testid="partner-edit-form"
    >
      {message?.tone === "error" && <div role="alert" className="rounded-sm border-l-4 border-danger bg-danger/5 p-3 text-sm font-semibold text-danger">{message.text}</div>}
      <Field id="dash-description" label={t("apply.description")} hint={t("apply.descriptionHint")} error={fields.description}>
        <Textarea rows={5} maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} {...fieldAria("dash-description", fields.description, true)} />
      </Field>
      <div>
        <p className="mb-2 text-sm font-semibold">{t("dashboard.services")}</p>
        <ServicesEditor value={list} onChange={setList} labels={labels} errors={rowErrors} />
        {fields.services && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{fields.services}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} data-testid="partner-edit-save">
          {busy ? <><Loader2 aria-hidden="true" className="animate-spin" /> {t("dashboard.saving")}</> : t("dashboard.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setDesc(description); setList(services); setFields({}); setMessage(null); }}>
          {t("dashboard.cancel")}
        </Button>
      </div>
    </form>
  );
}
