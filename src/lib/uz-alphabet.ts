/**
 * Uzbek Latin spelling. All Uzbek text is stored in the current official alphabet (oʻ, gʻ, sh, ch);
 * that stored text is what the site shows by default. Set NEXT_PUBLIC_UZ_SPELLING=new at build time to show it
 * in the new alphabet (ö, ğ, ş, ç) instead. (The older NEXT_PUBLIC_UZ_ALPHABET switch is ignored on purpose,
 * so servers whose .env still says "new" go back to the familiar spelling.)
 */
export const UZ_ALPHABET: "new" | "legacy" = process.env.NEXT_PUBLIC_UZ_SPELLING === "new" ? "new" : "legacy";

const APOS = "[ʻ‘’'`ʼ]";
const RULES: [RegExp, string][] = [
  [new RegExp(`O${APOS}`, "g"), "Ö"],
  [new RegExp(`o${APOS}`, "g"), "ö"],
  [new RegExp(`G${APOS}`, "g"), "Ğ"],
  [new RegExp(`g${APOS}`, "g"), "ğ"],
  [/SH/g, "Ş"],
  [/Sh/g, "Ş"],
  [/sh/g, "ş"],
  [/CH/g, "Ç"],
  [/Ch/g, "Ç"],
  [/ch/g, "ç"],
];

/**
 * Parts that must never change: links, e-mail addresses, site paths, Markdown link targets,
 * ICU argument names ("{children}"), HTML-like tags, and foreign words quoted inside Uzbek text
 * (a word with w, th, ck or a c that is not part of "ch" is not Uzbek, e.g. "check-in", "Wi-Fi").
 */
const PROTECT = /\b[A-Za-z]*(?:[Ww]|[Tt][Hh]|[Cc](?![Hh]))[A-Za-z]*\b|\b(?:[Mm]uch|[Ss]uch|[Ee]ach|[Ee]nglish|[Ll]unch|[Ss]hop[a-z]*|[Ss]how[a-z]*|[Bb]each|[Cc]hurch|[Ss]earch|[Rr]ich|[Dd]ish|[Ff]ish|[Ff]resh|[Ff]inish|[Pp]ush|[Bb]ranch|[Ss]hare[a-z]*|[Ss]hort|[Ss]hip[a-z]*)\b|https?:\/\/[^\s)\]]+|[\w.+-]+@[\w-]+\.[\w.-]+|\]\([^)]*\)|(?<!\b(?:zero|one|two|few|many|other|=\d+)\s*)\{\s*[A-Za-z0-9_]+\s*(?=[,}])|<\/?[A-Za-z0-9]+>|(?:^|(?<=[\s("']))\/[a-z0-9][\w\-/?=&.%#]*/g;
/** In ICU select messages, the option keys before "{" are code, not text. */
const SELECT_KEYS = /\b[A-Za-z0-9_]+(?=\s*\{)/g;

/** Converts Uzbek text from the current Latin spelling to the new one. Idempotent. */
export function toNewUzbek(text: string): string {
  if (!text || !/[OoGg][ʻ‘’'`ʼ]|[Ss][Hh]|[Cc][Hh]/.test(text)) return text;
  const kept: string[] = [];
  const hold = (m: string) => {
    kept.push(m);
    return `\u0000${kept.length - 1}\u0001`;
  };
  let t = text.replace(PROTECT, hold);
  if (/,\s*select\s*,/.test(text)) t = t.replace(SELECT_KEYS, hold);
  for (const [re, to] of RULES) t = t.replace(re, to);
  return t.replace(/\u0000(\d+)\u0001/g, (_, i: string) => kept[Number(i)] ?? "");
}

/** Uzbek text as the site shows it (new alphabet unless switched back). */
export function uzText(text: string): string {
  return UZ_ALPHABET === "new" ? toNewUzbek(text) : text;
}

/** Applies uzText to every string in a message tree or data object. */
export function uzDeep<T>(value: T): T {
  if (UZ_ALPHABET !== "new") return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return toNewUzbek(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Converts only the `uz` member of every { en, uz, ru } object inside a value (for seed data). */
export function uzInLocalized<T>(value: T): T {
  if (UZ_ALPHABET !== "new") return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const isText = typeof o.uz === "string" && typeof o.en === "string";
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, isText && k === "uz" ? toNewUzbek(x as string) : walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}
