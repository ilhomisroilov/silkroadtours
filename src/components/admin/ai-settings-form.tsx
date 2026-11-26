"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "./booking-actions";

type S = {
  assistantName: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  perMinuteLimit: number;
  retentionDays: number;
  enabled: boolean;
  welcome: { en: string; uz: string; ru: string };
  extraInstructions: string;
};

/** Editable assistant settings (owners only). The protected core rules are not part of this form. */
export function AiSettingsForm({ initial, canEdit }: { initial: S; canEdit: boolean; locale?: "uz" | "en" }) {
  const t = useTranslations("admin.aicenter.settingsForm");
  const call = useAdminApi();
  const [s, setS] = useState<S>(initial);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const field = "mt-1 min-h-11 w-full rounded-sm border border-field bg-white px-3 font-normal";
  const help = "mt-1 block text-xs font-normal text-ink-muted";
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await call("/api/admin/ai/settings", { method: "PUT", json: s }, t("saved"));
        setBusy(false);
      }}
    >
      <fieldset disabled={!canEdit || busy} className="space-y-5">
        <label className="inline-flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} className="size-5" /> {t("enabled")}
        </label>
        <label className="block max-w-md text-sm font-semibold">
          {t("name")}
          <input className={field} value={s.assistantName} onChange={(e) => setS({ ...s, assistantName: e.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <label className="block text-sm font-semibold">{t("temperature")}<input type="number" step="0.1" min={0} max={1} className={field} value={s.temperature} onChange={num("temperature")} /><span className={help}>{t("temperatureHelp")}</span></label>
          <label className="block text-sm font-semibold">{t("maxTokens")}<input type="number" min={200} max={2000} className={field} value={s.maxOutputTokens} onChange={num("maxOutputTokens")} /><span className={help}>{t("maxTokensHelp")}</span></label>
          <label className="block text-sm font-semibold">{t("timeout")}<input type="number" min={5000} max={60000} step={1000} className={field} value={s.timeoutMs} onChange={num("timeoutMs")} /><span className={help}>{t("timeoutHelp")}</span></label>
          <label className="block text-sm font-semibold">{t("rate")}<input type="number" min={2} max={60} className={field} value={s.perMinuteLimit} onChange={num("perMinuteLimit")} /><span className={help}>{t("rateHelp")}</span></label>
          <label className="block text-sm font-semibold">{t("retention")}<input type="number" min={1} max={365} className={field} value={s.retentionDays} onChange={num("retentionDays")} /><span className={help}>{t("retentionHelp")}</span></label>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{t("welcome")}</legend>
          {(["uz", "en", "ru"] as const).map((l) => (
            <label key={l} className="block text-xs font-bold uppercase tracking-wide text-ink-muted">
              {l}
              <textarea rows={2} lang={l} className={`${field} py-2 text-base normal-case tracking-normal text-ink`} value={s.welcome[l]} onChange={(e) => setS({ ...s, welcome: { ...s.welcome, [l]: e.target.value } })} />
            </label>
          ))}
        </fieldset>
        <label className="block text-sm font-semibold">
          {t("extra")}
          <textarea rows={4} maxLength={2000} className={`${field} py-2`} value={s.extraInstructions} onChange={(e) => setS({ ...s, extraInstructions: e.target.value })} />
          <span className={help}>{t("extraHelp")}</span>
        </label>
        <Button type="submit">{busy ? t("saving") : t("save")}</Button>
      </fieldset>
      {!canEdit && <p className="text-sm text-ink-muted">{t("ownerOnly")}</p>}
    </form>
  );
}
