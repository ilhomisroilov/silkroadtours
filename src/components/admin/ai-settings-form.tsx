"use client";

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

const L = {
  uz: { name: "Nomi", enabled: "Yordamchi yoqilgan", temp: "Temperature", tokens: "Maks. token", timeout: "Timeout (ms)", rate: "Soʻrov/daqiqa (IP)", retention: "Saqlash muddati (kun)", welcome: "Salomlashish", extra: "Qoʻshimcha koʻrsatmalar (ohang, tavsiya qoidalari)", save: "Saqlash", saved: "Saqlandi", owner: "Faqat egasi (owner) oʻzgartira oladi." },
  en: { name: "Name", enabled: "Assistant enabled", temp: "Temperature", tokens: "Max tokens", timeout: "Timeout (ms)", rate: "Requests/minute (IP)", retention: "Retention (days)", welcome: "Welcome message", extra: "Extra instructions (tone, recommendation rules)", save: "Save", saved: "Saved", owner: "Only owners can change these." },
};

export function AiSettingsForm({ initial, locale, canEdit }: { initial: S; locale: "uz" | "en"; canEdit: boolean }) {
  const t = L[locale];
  const call = useAdminApi();
  const [s, setS] = useState<S>(initial);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const field = "mt-1 min-h-11 w-full rounded-sm border border-field bg-white px-3";
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await call("/api/admin/ai/settings", { method: "PUT", json: s }, t.saved);
        setBusy(false);
      }}
    >
      <fieldset disabled={!canEdit || busy} className="space-y-4">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} className="size-5" /> {t.enabled}
        </label>
        <label className="block text-sm font-bold">{t.name}<input className={field} value={s.assistantName} onChange={(e) => setS({ ...s, assistantName: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="block text-sm font-bold">{t.temp}<input type="number" step="0.1" min={0} max={1} className={field} value={s.temperature} onChange={num("temperature")} /></label>
          <label className="block text-sm font-bold">{t.tokens}<input type="number" min={200} max={2000} className={field} value={s.maxOutputTokens} onChange={num("maxOutputTokens")} /></label>
          <label className="block text-sm font-bold">{t.timeout}<input type="number" min={5000} max={60000} step={1000} className={field} value={s.timeoutMs} onChange={num("timeoutMs")} /></label>
          <label className="block text-sm font-bold">{t.rate}<input type="number" min={2} max={60} className={field} value={s.perMinuteLimit} onChange={num("perMinuteLimit")} /></label>
          <label className="block text-sm font-bold">{t.retention}<input type="number" min={1} max={365} className={field} value={s.retentionDays} onChange={num("retentionDays")} /></label>
        </div>
        {(["uz", "en", "ru"] as const).map((l) => (
          <label key={l} className="block text-sm font-bold">
            {t.welcome} ({l.toUpperCase()})
            <textarea rows={2} className={`${field} py-2`} value={s.welcome[l]} onChange={(e) => setS({ ...s, welcome: { ...s.welcome, [l]: e.target.value } })} />
          </label>
        ))}
        <label className="block text-sm font-bold">
          {t.extra}
          <textarea rows={4} maxLength={2000} className={`${field} py-2`} value={s.extraInstructions} onChange={(e) => setS({ ...s, extraInstructions: e.target.value })} />
        </label>
        <Button type="submit">{t.save}</Button>
      </fieldset>
      {!canEdit && <p className="text-sm text-ink-muted">{t.owner}</p>}
    </form>
  );
}
