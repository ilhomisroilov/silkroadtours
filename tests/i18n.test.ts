import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { IntlMessageFormat } from "intl-messageformat";

type Tree = { [k: string]: string | Tree };
const load = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Tree;
const flatten = (o: Tree, prefix = ""): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "string") acc[prefix + k] = v;
    else Object.assign(acc, flatten(v, `${prefix}${k}.`));
    return acc;
  }, {});

const site = { en: flatten(load("messages/en.json")), uz: flatten(load("messages/uz.json")), ru: flatten(load("messages/ru.json")) };
const admin = { en: flatten(load("messages/admin/en.json")), uz: flatten(load("messages/admin/uz.json")) };

/** Sample values for every placeholder so each message can be formatted. */
function sampleArgs(msg: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const m of msg.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(,\s*(plural|select|number|date))?/g)) args[m[1]!] = m[3] === "select" ? "other" : 2;
  return args;
}

describe("message files", () => {
  it("every site key exists in English, Uzbek and Russian", () => {
    const keys = Object.keys(site.en).sort();
    assert.ok(keys.length > 500, `expected > 500 keys, got ${keys.length}`);
    assert.deepEqual(Object.keys(site.uz).sort(), keys, "uz.json keys differ from en.json");
    assert.deepEqual(Object.keys(site.ru).sort(), keys, "ru.json keys differ from en.json");
  });

  it("every admin key exists in Uzbek and English", () => {
    assert.deepEqual(Object.keys(admin.en).sort(), Object.keys(admin.uz).sort());
  });

  it("no message is empty and every message is valid ICU that formats", () => {
    const all = [
      ...Object.entries(site).flatMap(([l, m]) => Object.entries(m).map(([k, v]) => [l, k, v] as const)),
      ...Object.entries(admin).flatMap(([l, m]) => Object.entries(m).map(([k, v]) => [`admin/${l}`, k, v] as const)),
    ];
    for (const [l, k, v] of all) {
      assert.ok(v.trim().length > 0, `${l}:${k} is empty`);
      const locale = l.replace("admin/", "");
      assert.doesNotThrow(() => new IntlMessageFormat(v, locale).format(sampleArgs(v)), `${l}:${k} is not valid ICU: ${v}`);
    }
  });

  it("uses the same placeholders in every language", () => {
    // Walk the ICU AST: argument names live in `value` of argument/number/date/select/plural nodes.
    type Node = { type: number; value?: string; options?: Record<string, { value: Node[] }> };
    const names = (msg: string, locale: string) => {
      const out = new Set<string>();
      const walk = (nodes: Node[]) => {
        for (const n of nodes) {
          if (n.type >= 1 && n.type <= 6 && n.value) out.add(n.value);
          if (n.options) for (const o of Object.values(n.options)) walk(o.value);
        }
      };
      walk(new IntlMessageFormat(msg, locale).getAst() as unknown as Node[]);
      return out;
    };
    for (const k of Object.keys(site.en)) {
      const en = names(site.en[k]!, "en");
      for (const l of ["uz", "ru"] as const) {
        for (const n of names(site[l][k]!, l)) assert.ok(en.has(n), `${l}:${k} uses {${n}} which en.json does not`);
        for (const n of en) assert.ok(names(site[l][k]!, l).has(n), `${l}:${k} is missing {${n}}`);
      }
    }
  });

  it("writes Uzbek oʻ and gʻ with the modifier letter ʻ (U+02BB), not an apostrophe", () => {
    const bad = Object.entries(site.uz).filter(([k, v]) => !k.startsWith("languages.") && /\b[OoGg]['‘’`]/.test(v.replace(/so'm/g, "")));
    assert.deepEqual(bad.map(([k]) => k), []);
  });
});
