import { DEFAULT_LOCALE, type Locale, type LocalizedText } from "../db/types";

/** Picks the requested language, falling back to English, then to any non-empty value. */
export function localize(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  return (
    text[locale]?.trim() ||
    text[DEFAULT_LOCALE]?.trim() ||
    Object.values(text).find((v) => v?.trim()) ||
    ""
  );
}
