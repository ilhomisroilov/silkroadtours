"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { LocalizedText } from "@/db/types";
import { cn } from "@/lib/cn";
import { uzText } from "@/lib/uz-alphabet";

const LANGS = [
  { key: "en", label: "English" },
  { key: "uz", label: uzText("Oʻzbekcha") },
  { key: "ru", label: "Русский" },
] as const;

export const emptyLocalized = (): LocalizedText => ({ en: "", uz: "", ru: "" });

/** en / uz / ru side by side, with a warning when a translation is missing. */
export function LocalizedFields({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  required = false,
}: {
  label: string;
  value: LocalizedText | null | undefined;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
}) {
  const t = useTranslations("admin.tours");
  const id = useId();
  const v = value ?? emptyLocalized();
  const missing = LANGS.filter((l) => l.key !== "en" && v.en.trim() && !v[l.key].trim());
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">
        {label}
        {required && <span aria-hidden="true" className="text-pomegranate"> *</span>}
      </legend>
      <div className="grid gap-2 lg:grid-cols-3">
        {LANGS.map((l) => {
          const fid = `${id}-${l.key}`;
          const cls = cn(
            "block w-full rounded-sm border bg-white px-3 py-2",
            !v[l.key].trim() && (l.key === "en" ? required : !!v.en.trim()) ? "border-saffron bg-saffron-soft/30" : "border-field",
          );
          return (
            <div key={l.key}>
              <label htmlFor={fid} className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-muted" lang={l.key}>{l.label}</label>
              {multiline ? (
                <textarea id={fid} rows={rows} lang={l.key} value={v[l.key]} onChange={(e) => onChange({ ...v, [l.key]: e.target.value })} className={cls} />
              ) : (
                <input id={fid} lang={l.key} value={v[l.key]} onChange={(e) => onChange({ ...v, [l.key]: e.target.value })} className={cn(cls, "min-h-11")} />
              )}
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-saffron-ink" role="status">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {missing.map((l) => t("missingTranslation", { lang: l.label })).join(" ")}
        </p>
      )}
    </fieldset>
  );
}

/** Lists of localized lines (e.g. included / excluded): one textarea per language, one item per line. */
export function LocalizedLines({ label, value, onChange }: { label: string; value: LocalizedText[]; onChange: (v: LocalizedText[]) => void }) {
  const joined: LocalizedText = {
    en: value.map((x) => x.en).join("\n"),
    uz: value.map((x) => x.uz).join("\n"),
    ru: value.map((x) => x.ru).join("\n"),
  };
  return (
    <LocalizedFields
      label={label}
      multiline
      rows={6}
      value={joined}
      onChange={(v) => {
        const lines = { en: v.en.split("\n"), uz: v.uz.split("\n"), ru: v.ru.split("\n") };
        const n = Math.max(lines.en.length, lines.uz.length, lines.ru.length);
        const out: LocalizedText[] = [];
        for (let i = 0; i < n; i++) out.push({ en: lines.en[i] ?? "", uz: lines.uz[i] ?? "", ru: lines.ru[i] ?? "" });
        onChange(out);
      }}
    />
  );
}
