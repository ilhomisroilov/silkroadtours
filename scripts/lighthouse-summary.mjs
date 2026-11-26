#!/usr/bin/env node
/**
 * Prints a compact table of the latest Lighthouse CI run (.lighthouseci/lhr-*.json): median
 * scores per URL plus the elements responsible for layout shift and the longest main-thread
 * tasks — enough to diagnose a failed budget from the CI log alone.
 */
import { readdirSync, readFileSync } from "node:fs";

const dir = ".lighthouseci";
const runs = readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
const byUrl = new Map();
for (const r of runs) byUrl.set(r.finalDisplayedUrl, [...(byUrl.get(r.finalDisplayedUrl) ?? []), r]);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const [url, list] of byUrl) {
  const perf = (r) => r.categories.performance.score;
  const rep = [...list].sort((a, b) => perf(a) - perf(b))[Math.floor(list.length / 2)];
  const a = rep.audits;
  console.log(`\n${url}  (${list.length} runs, Chrome ${rep.environment?.hostUserAgent?.match(/Chrome\/[\d.]+/)?.[0] ?? "?"}, benchmarkIndex ${rep.environment?.benchmarkIndex ?? "?"})`);
  console.log(`  perf ${median(list.map(perf))}  a11y ${rep.categories.accessibility.score}  bp ${rep.categories["best-practices"].score}  seo ${rep.categories.seo.score}`);
  console.log(`  LCP ${Math.round(median(list.map((r) => r.audits["largest-contentful-paint"].numericValue)))} ms  CLS ${median(list.map((r) => r.audits["cumulative-layout-shift"].numericValue)).toFixed(3)}  TBT ${Math.round(median(list.map((r) => r.audits["total-blocking-time"].numericValue)))} ms`);
  for (const it of a["layout-shifts"]?.details?.items ?? []) {
    console.log(`  shift ${Number(it.score).toFixed(3)}  ${it.node?.selector ?? ""}  ${(it.node?.snippet ?? "").slice(0, 110)}`);
    for (const c of it.subItems?.items ?? []) console.log(`        cause: ${c.cause}${c.extra?.value ? ` ${String(c.extra.value).slice(-60)}` : ""}`);
  }
  for (const t of (a["long-tasks"]?.details?.items ?? []).slice(0, 4)) console.log(`  long task ${Math.round(t.duration)} ms  ${String(t.url).slice(-60)}`);
}
