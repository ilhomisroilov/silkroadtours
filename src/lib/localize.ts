import { DEFAULT_LOCALE, type Locale, type LocalizedText } from "../db/types";
import { uzText } from "./uz-alphabet";

/** Picks the requested language, falling back to English, then to any non-empty value. */
export function localize(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const own = text[locale]?.trim();
  if (own && locale === "uz") return uzText(own);
  return (
    own ||
    text[DEFAULT_LOCALE]?.trim() ||
    Object.values(text).find((v) => v?.trim()) ||
    ""
  );
}
