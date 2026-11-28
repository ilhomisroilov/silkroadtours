"use client";

import { CheckCircleFilled, ExclamationCircleFilled } from "@ant-design/icons";
import { Alert, Flex, Input, Segmented, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import type { LocalizedText } from "@/db/types";
import { uzText } from "@/lib/uz-alphabet";

type Lang = "en" | "uz" | "ru";

const LANGS: { key: Lang; short: string; label: string }[] = [
  { key: "uz", short: "UZ", label: uzText("Oʻzbekcha") },
  { key: "en", short: "EN", label: "English" },
  { key: "ru", short: "RU", label: "Русский" },
];

export const emptyLocalized = (): LocalizedText => ({ en: "", uz: "", ru: "" });

/**
 * One editing language for a whole form: switch once at the top and every translated field follows, so the
 * editor writes the Uzbek version of the page in one pass instead of hunting through three columns.
 */
const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void } | null>(null);

export function EditLanguageProvider({ children }: { children: ReactNode }) {
  const panel = useLocale();
  const [lang, setLang] = useState<Lang>(panel === "en" ? "en" : "uz");
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/** The form-wide language switch. Put it once near the top of an editor wrapped in EditLanguageProvider. */
export function EditLanguageSwitch() {
  const ctx = useContext(LangContext);
  const t = useTranslations("admin.panel");
  if (!ctx) return null;
  return (
    <Flex align="center" gap={10} wrap>
      <Typography.Text strong>{t("editLanguage")}:</Typography.Text>
      <Segmented<Lang> value={ctx.lang} onChange={ctx.setLang} options={LANGS.map((l) => ({ value: l.key, label: l.label }))} />
    </Flex>
  );
}

function useLang(): [Lang, (l: Lang) => void] {
  const ctx = useContext(LangContext);
  const panel = useLocale();
  const [own, setOwn] = useState<Lang>(panel === "en" ? "en" : "uz");
  return ctx ? [ctx.lang, ctx.setLang] : [own, setOwn];
}

function filled(v: LocalizedText, l: Lang) {
  return !!v[l]?.trim();
}

/** A translated text field: one language at a time, each tab marked filled or missing. */
export function LocalizedFields({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  required = false,
  help,
}: {
  label: string;
  value: LocalizedText | null | undefined;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  help?: ReactNode;
}) {
  const t = useTranslations("admin.tours");
  const id = useId();
  const [lang, setLang] = useLang();
  const v = value ?? emptyLocalized();
  const anyFilled = LANGS.some((l) => filled(v, l.key));
  const missing = LANGS.filter((l) => anyFilled && !filled(v, l.key));
  const hint = LANGS.map((l) => v[l.key]).find((x) => x?.trim()) ?? "";
  const fid = `${id}-${lang}`;
  const common = {
    id: fid,
    lang,
    value: v[lang],
    placeholder: filled(v, lang) ? undefined : hint.slice(0, 140),
    status: required && !anyFilled ? ("warning" as const) : undefined,
  };
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 18px", minWidth: 0 }}>
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 6 }}>
        <legend style={{ padding: 0, fontWeight: 600, fontSize: 14, float: "left" }}>
          <label htmlFor={fid}>{label}</label>
          {required && <span aria-hidden="true" style={{ color: "#d4380d" }}> *</span>}
        </legend>
        <Segmented<Lang>
          size="small"
          value={lang}
          onChange={setLang}
          options={LANGS.map((l) => ({
            value: l.key,
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {l.short}
                {filled(v, l.key)
                  ? <CheckCircleFilled aria-label="✓" style={{ color: "#389e0d", fontSize: 11 }} />
                  : <ExclamationCircleFilled aria-label="!" style={{ color: anyFilled || required ? "#d48806" : "#bfbfbf", fontSize: 11 }} />}
              </span>
            ),
          }))}
        />
      </Flex>
      {multiline ? (
        <Input.TextArea {...common} autoSize={{ minRows: rows, maxRows: Math.max(rows * 3, 12) }} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} />
      ) : (
        <Input {...common} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} />
      )}
      {help && <Typography.Text type="secondary" style={{ display: "block", fontSize: 13, marginTop: 4 }}>{help}</Typography.Text>}
      {missing.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8, padding: "4px 10px", fontSize: 13 }}
          message={missing.map((l) => t("missingTranslation", { lang: l.label })).join(" ")}
          role="status"
        />
      )}
    </fieldset>
  );
}

/** Lists of translated lines (included / excluded): one item per line, edited in the current language. */
export function LocalizedLines({ label, value, onChange, help }: { label: string; value: LocalizedText[]; onChange: (v: LocalizedText[]) => void; help?: ReactNode }) {
  const joined: LocalizedText = {
    en: value.map((x) => x.en).join("\n"),
    uz: value.map((x) => x.uz).join("\n"),
    ru: value.map((x) => x.ru).join("\n"),
  };
  return (
    <LocalizedFields
      label={label}
      multiline
      rows={5}
      value={joined}
      help={help}
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
