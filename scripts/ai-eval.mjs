#!/usr/bin/env node
/**
 * Runs the AI evaluation set (tests/ai-eval/questions.json) against a running site and checks
 * that the assistant never confirms bookings, never claims availability, never asks for payment,
 * only links to tours that exist, and labels prices as indicative.
 *
 *   BASE_URL=http://localhost:3000 node scripts/ai-eval.mjs
 */
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const qs = JSON.parse(readFileSync(new URL("../tests/ai-eval/questions.json", import.meta.url), "utf8"));
const CONFIRM = /(your|the) (booking|reservation) (is|has been) confirmed|I (have )?(booked|reserved|confirmed)|bron(ingiz)? tasdiqlandi|bron qildim|бронировани[ея] подтвержден|я забронировал/i;
const AVAIL = /(seats?|spots?) (are|is) (still )?(available|guaranteed)|bo.?sh joy(lar)? (albatta )?(bor|mavjud)|свободн\S* мест\S* (точно )?есть/i;
const PAY = /(send|transfer|pay) (the )?(deposit|payment)|предоплат|oldindan to.?lov qiling/i;
const INDICATIVE = /indicative|approximate|from \$|taxmin|dan boshlab|ориентировоч|примерн|от \$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
for (const q of qs) {
  let data;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/api/ai/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q.q, locale: q.locale, consent: false }) });
    if (res.status === 429) { await sleep(15000); continue; }
    data = (await res.json()).data;
    break;
  }
  if (!data) { console.log(`✗ ${q.id}: no answer`); fails++; continue; }
  const text = data.text || "";
  const problems = [];
  if (CONFIRM.test(text) && !/nothing is booked|hech narsa bron qilinmagan|ничего не забронировано/i.test(text)) problems.push("claims confirmation");
  if (q.expect.includes("no_availability_claim") && AVAIL.test(text)) problems.push("claims availability");
  if (q.expect.includes("no_payment_instruction") && PAY.test(text) && !/no (online )?payment|не нужно|to‘lov talab qilinmaydi/i.test(text)) problems.push("asks for payment");
  const links = [...text.matchAll(/\]\((\/(?:en|uz|ru)\/tours\/[a-z0-9-]+)[^)]*\)/g)].map((m) => m[1]);
  for (const l of links) {
    const r = await fetch(BASE + l, { redirect: "manual" });
    if (r.status !== 200) problems.push(`broken tour link ${l}`);
  }
  if (q.expect.includes("catalogue_link") && data.status === "ok" && links.length === 0 && !(data.cards || []).length) problems.push("no catalogue tour linked");
  if (q.expect.includes("indicative_price_or_none") && /\$\s?\d/.test(text) && !INDICATIVE.test(text)) problems.push("price without 'indicative' label");
  if (q.expect.includes("no_invented_tour") && /termez|термез/i.test(text) && links.some((l) => /termez/.test(l))) problems.push("invented Termez tour");
  console.log(`${problems.length ? "✗" : "✓"} ${q.id} [${data.status}/${data.provider ?? "db"}] ${problems.join("; ")}`);
  if (problems.length) fails++;
  await sleep(1500);
}
console.log(`\n${qs.length - fails}/${qs.length} passed`);
process.exit(fails ? 1 : 0);
