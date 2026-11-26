// Output guard for AI replies (no server-only import so it can be unit-tested).
// The system prompt already forbids these claims; this is the second line of defence.

const UNSAFE: { re: RegExp; kind: "confirmation" | "availability" | "payment" }[] = [
  { re: /\b(your|the)\s+(booking|reservation|tour)\s+(is|has been|was)\s+(now\s+)?(confirmed|booked|reserved|secured)\b/i, kind: "confirmation" },
  { re: /\bI\s+(have\s+|'ve\s+)?(booked|reserved|confirmed|secured)\b/i, kind: "confirmation" },
  { re: /\b(seats?|spots?|rooms?)\s+(are|is)\s+(still\s+)?(available|guaranteed|free)\b/i, kind: "availability" },
  { re: /\bguaranteed\s+(availability|departure|price)\b/i, kind: "availability" },
  { re: /\b(pay|send|transfer)\s+(the\s+)?(deposit|payment|money)\s+(to|via|by)\b/i, kind: "payment" },
  { re: /bron(ingiz|lar)?\s+(muvaffaqiyatli\s+)?tasdiqlandi/i, kind: "confirmation" },
  { re: /(siz\s+uchun\s+)?bron\s+qil(dim|indi)\b/i, kind: "confirmation" },
  { re: /bo[‘’ʻ\'`]?sh\s+joy(lar)?\s+(albatta\s+|aniq\s+)?(bor|mavjud|kafolatlangan)/i, kind: "availability" },
  { re: /(ваше\s+)?бронировани[ея]\s+(успешно\s+)?подтвержден/i, kind: "confirmation" },
  { re: /я\s+(уже\s+)?(забронировал|подтвердил)/i, kind: "confirmation" },
  { re: /свободн\S*\s+мест\S*\s+(точно\s+)?(есть|гарантирован)|мест[аы]?\s+гарантирован/i, kind: "availability" },
  { re: /(внесите|переведите|оплатите)\s+(предоплату|депозит)/i, kind: "payment" },
];

export function findUnsafeClaims(text: string): ("confirmation" | "availability" | "payment")[] {
  return [...new Set(UNSAFE.filter((u) => u.re.test(text)).map((u) => u.kind))];
}

const NOTE = {
  en: "Please note: nothing is booked, reserved or paid yet. Availability and the final price are confirmed only by our team after you send a booking request.",
  uz: "Eslatma: hali hech narsa bron qilinmagan va toʻlanmagan. Boʻsh joy va yakuniy narxni bron soʻrovi yuborganingizdan keyin faqat jamoamiz tasdiqlaydi.",
  ru: "Обратите внимание: пока ничего не забронировано и не оплачено. Наличие мест и итоговую цену подтверждает только наша команда после вашей заявки.",
} as const;

/** Returns the reply with a correction appended when it contains a claim the assistant may never make. */
export function enforceSafeReply(text: string, lang: "en" | "uz" | "ru"): { text: string; flagged: string[] } {
  const flagged = findUnsafeClaims(text);
  if (!flagged.length) return { text, flagged };
  return { text: `${text.trim()}\n\n**${NOTE[lang] ?? NOTE.en}**`, flagged };
}

/**
 * Models sometimes turn the relative links our tools return (/uz/tours/…) into absolute ones with an invented
 * host such as http://localhost:8080. Links to our own pages on such hosts (or our own domain) become relative
 * again; links to other sites are left alone.
 */
const SITE_PATH = String.raw`/(?:en|uz|ru)(?:/[^\s)\]]*)?`;
const OUR_HOSTS = String.raw`(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|(?:www\.)?example\.(?:com|org)|(?:www\.)?nationaltours\.uz|(?:www\.)?silkroadtours\.uz)(?::\d+)?`;
const OWN_LINK = new RegExp(String.raw`https?://${OUR_HOSTS}(${SITE_PATH})`, "gi");

export function relativizeSiteLinks(text: string): string {
  return text.replace(OWN_LINK, "$1");
}
