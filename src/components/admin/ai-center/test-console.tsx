"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, Loader2, MessageSquarePlus, Play, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { RichText } from "@/components/ai/rich-text";
import { Button } from "@/components/ui/button";
import { apiFetch, translateCode } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { TEST_PROMPTS, type TestPromptId } from "./test-prompts";
import { uzText } from "@/lib/uz-alphabet";

/** Preset prompts as the admin sees them (Uzbek in the new alphabet). */
const promptText = (p: (typeof TEST_PROMPTS)[number], l: keyof (typeof TEST_PROMPTS)[number]["text"]) => (l === "uz" ? uzText(p.text.uz) : p.text[l]);

type Lang = "en" | "uz" | "ru";
const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "uz", label: uzText("Oʻzbekcha") },
  { key: "ru", label: "Русский" },
];

interface TestResult {
  conversationId: string;
  enabled: boolean;
  chain: { id: string; model: string; role: string }[];
  text: string | null;
  outcome: "ok" | "fallback" | "failed";
  storedStatus: string | null;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  elapsedMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
  sources: string[];
  language: Lang;
  cards: { kind: string; slug: string; title: string; url: string; meta: string }[];
  bookingDraft: { title: string; url: string; adults: number; children: number; preferredDate?: string } | null;
  toolCalls: { tool: string; input: string; ok: boolean; resultCount: number | null }[];
}

interface Run {
  key: number;
  prompt: string;
  promptId?: TestPromptId;
  locale: Lang;
  result?: TestResult;
  requestError?: string;
}

const ERROR_KINDS = ["quota", "unavailable", "timeout", "bad_response", "not_configured", "blocked", "guard", "no_provider_configured"] as const;

/** "gemini:unavailable:fetch failed" → { provider: "gemini", kind: "unavailable", detail } */
function parseError(e: string): { provider?: string; kind?: (typeof ERROR_KINDS)[number]; detail: string } {
  if (e === "no_provider_configured") return { kind: "no_provider_configured", detail: e };
  if (e.startsWith("guard:")) return { kind: "guard", detail: e.slice(6) };
  const [provider, kind, ...rest] = e.split(":");
  if (kind && (ERROR_KINDS as readonly string[]).includes(kind)) return { provider, kind: kind as (typeof ERROR_KINDS)[number], detail: rest.join(":").trim() };
  return { detail: e };
}

function prettyInput(raw: string): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const parts = Object.entries(o).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    return parts.length ? parts.join(" · ") : "—";
  } catch {
    return raw;
  }
}

export function TestConsole({ chain, enabled, defaultLocale }: { chain: { id: string; model: string; role: string }[]; enabled: boolean; defaultLocale: Lang }) {
  const t = useTranslations("admin.aicenter.console");
  const tp = useTranslations("admin.aicenter.prompts");
  const te = useTranslations("errors");
  const ids = useId();
  const [locale, setLocale] = useState<Lang>(defaultLocale);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState<TestPromptId | undefined>();
  const [keepContext, setKeepContext] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const counter = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const h = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [busy]);

  const run = async (text: string, id?: TestPromptId, lang: Lang = locale) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    const key = ++counter.current;
    const continueId = keepContext && conversationId ? conversationId : undefined;
    setRuns((r) => [{ key, prompt: clean, promptId: id, locale: lang }, ...r].slice(0, 12));
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const r = await apiFetch<TestResult>("/api/admin/ai/test", { method: "POST", json: { prompt: clean, locale: lang, conversationId: continueId } });
    setBusy(false);
    setRuns((all) =>
      all.map((x) => (x.key !== key ? x : r.ok ? { ...x, result: r.data } : { ...x, requestError: r.status === 401 ? t("signedOut") : translateCode(r.error.code, te as never) || t("requestFailed") })),
    );
    if (r.ok) setConversationId(r.data.conversationId);
  };

  const chainText = chain.length ? chain.map((c) => `${c.id} · ${c.model}`).join(" → ") : t("noChain");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <section className="rounded-sm border border-line bg-white p-4 shadow-sm sm:p-5" aria-labelledby={`${ids}-title`}>
          <h2 id={`${ids}-title`} className="font-sans text-lg font-bold text-lapis-deep">{t("title")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("intro")}</p>
          <p className="mt-3 rounded-sm bg-sand-soft/70 px-3 py-2 text-xs text-ink-muted">
            <span className="font-semibold text-ink">{t("chain")}:</span> <span className="break-words font-mono">{chainText}</span>
            {!enabled && <span className="mt-1 block font-semibold text-terracotta-deep">{t("disabled")}</span>}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(prompt, presetId);
            }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold" htmlFor={`${ids}-locale`}>
                {t("language")}
                <select
                  id={`${ids}-locale`}
                  value={locale}
                  onChange={(e) => {
                    const l = e.target.value as Lang;
                    setLocale(l);
                    const preset = TEST_PROMPTS.find((p) => p.id === presetId);
                    if (preset && prompt === promptText(preset, locale)) setPrompt(promptText(preset, l));
                  }}
                  className="mt-1 block min-h-11 rounded-sm border border-field bg-white px-3 font-normal"
                  data-testid="ai-test-locale"
                >
                  {LANGS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </label>
              {conversationId && (
                <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-5" checked={keepContext} onChange={(e) => setKeepContext(e.target.checked)} />
                  {t("keepContext")}
                </label>
              )}
            </div>
            <label className="block text-sm font-semibold" htmlFor={`${ids}-prompt`}>{t("prompt")}</label>
            <textarea
              id={`${ids}-prompt`}
              rows={5}
              maxLength={1500}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setPresetId(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void run(prompt, presetId);
                }
              }}
              placeholder={t("placeholder")}
              className="block w-full rounded-sm border border-field bg-white px-3 py-2"
              aria-describedby={`${ids}-hint`}
              data-testid="ai-test-prompt"
            />
            <p id={`${ids}-hint`} className="text-xs text-ink-muted">{t("shortcut")}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !prompt.trim()} data-testid="ai-test-run">
                {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />} {busy ? t("running", { s: seconds }) : t("run")}
              </Button>
              {conversationId && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setConversationId(null);
                    setKeepContext(false);
                    setRuns([]);
                  }}
                >
                  <MessageSquarePlus aria-hidden="true" /> {t("newConversation")}
                </Button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-sm border border-line bg-white p-4 shadow-sm sm:p-5" aria-labelledby={`${ids}-presets`}>
          <h2 id={`${ids}-presets`} className="font-sans text-lg font-bold text-lapis-deep">{t("presets")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("presetsHint")}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {TEST_PROMPTS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPrompt(promptText(p, locale));
                    setPresetId(p.id);
                    void run(promptText(p, locale), p.id);
                  }}
                  className="flex min-h-11 w-full flex-col items-start rounded-sm border border-line bg-white px-3 py-2 text-left transition-colors hover:border-lapis hover:bg-lapis/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt disabled:opacity-60"
                  data-testid={`ai-preset-${p.id}`}
                >
                  <span className="text-sm font-bold text-lapis-deep">{tp(`${p.id}.label`)}</span>
                  <span className="line-clamp-2 text-xs text-ink-muted">{promptText(p, locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div ref={resultsRef} className="scroll-mt-20 space-y-4" aria-live="polite" aria-busy={busy}>
        {runs.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-sm border border-dashed border-line bg-white/60 p-8 text-center">
            <Wrench aria-hidden="true" className="size-8 text-ink-muted" />
            <p className="mt-3 font-semibold text-ink">{t("emptyTitle")}</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">{t("emptyBody")}</p>
          </div>
        ) : (
          runs.map((r) => <RunCard key={r.key} run={r} />)
        )}
      </div>
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  const t = useTranslations("admin.aicenter.console");
  const tp = useTranslations("admin.aicenter.prompts");
  const res = run.result;
  const pending = !res && !run.requestError;
  const err = res?.error ? parseError(res.error) : null;
  const badge = !res
    ? null
    : res.outcome === "ok"
      ? { cls: "bg-turquoise-ink/10 text-turquoise-ink", icon: CheckCircle2, label: t("outcome.ok") }
      : res.outcome === "fallback"
        ? { cls: "bg-terracotta/10 text-terracotta-deep", icon: CircleSlash, label: t("outcome.fallback") }
        : { cls: "bg-danger/10 text-danger", icon: AlertTriangle, label: t("outcome.failed") };
  return (
    <article className="overflow-hidden rounded-sm border border-line bg-white shadow-sm" data-testid="ai-test-result">
      <header className="border-b border-line bg-sand-soft/60 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          {run.promptId ? tp(`${run.promptId}.label`) : t("customPrompt")} · {run.locale.toUpperCase()}
        </p>
        <p className="mt-1 text-sm text-ink">{run.prompt}</p>
      </header>
      <div className="space-y-4 p-4">
        {pending && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" /> {t("waiting")}
          </p>
        )}
        {run.requestError && (
          <p role="alert" className="rounded-sm border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{run.requestError}</p>
        )}
        {res && badge && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", badge.cls)}>
                <badge.icon aria-hidden="true" className="size-4" /> {badge.label}
              </span>
              {res.storedStatus === "unanswered" && <span className="rounded-full bg-saffron-soft px-3 py-1 text-xs font-bold text-saffron-ink">{t("unanswered")}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-xs font-semibold text-ink-muted">{t("meta.provider")}</dt>
                <dd className="break-words font-semibold">{res.provider ? `${res.provider}${res.model ? ` · ${res.model}` : ""}` : t("meta.catalogue")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">{t("meta.latency")}</dt>
                <dd className="font-semibold tabular-nums">{t("meta.seconds", { s: (res.latencyMs / 1000).toFixed(1) })}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">{t("meta.tokens")}</dt>
                <dd className="font-semibold tabular-nums">{res.tokensIn != null || res.tokensOut != null ? `${res.tokensIn ?? 0} / ${res.tokensOut ?? 0}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">{t("meta.language")}</dt>
                <dd className="font-semibold uppercase">{res.language}</dd>
              </div>
            </dl>

            {err && (
              <div role="status" className={cn("rounded-sm border p-3 text-sm", err.kind === "guard" ? "border-saffron/50 bg-saffron-soft/40" : "border-danger/30 bg-danger/5")}>
                <p className={cn("font-semibold", err.kind === "guard" ? "text-saffron-ink" : "text-danger")}>
                  {err.kind ? t(`errorKinds.${err.kind}`) : t("errorKinds.other")}
                  {err.provider ? ` · ${err.provider}` : ""}
                </p>
                {err.detail && <p className="mt-1 break-words font-mono text-xs text-ink-muted">{err.detail}</p>}
                {res.outcome !== "ok" && <p className="mt-2 text-xs text-ink-muted">{res.chain.length ? t("fallbackExplained") : t("noChainExplained")}</p>}
              </div>
            )}
            {!err && res.outcome !== "ok" && <p className="rounded-sm bg-sand-soft/70 p-3 text-xs text-ink-muted">{res.enabled ? (res.chain.length ? t("fallbackExplained") : t("noChainExplained")) : t("disabled")}</p>}

            {res.text && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t("answer")}</h3>
                <div className="mt-1 rounded-sm border border-line bg-ivory/60 px-3 py-2 text-[0.95rem] leading-relaxed">
                  <RichText text={res.text} />
                </div>
              </div>
            )}

            {res.cards.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t("cards")}</h3>
                <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                  {res.cards.map((c) => (
                    <li key={c.kind + c.slug} className="rounded-sm border border-line px-3 py-2 text-sm">
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-lapis underline">{c.title}</a>
                      <span className="block text-xs text-ink-muted">{c.kind} · {c.meta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {res.bookingDraft && (
              <p className="rounded-sm border border-lapis/20 bg-lapis/5 p-3 text-sm">
                <span className="font-semibold">{t("bookingDraft")}:</span> {res.bookingDraft.title} · {t("travellers", { adults: res.bookingDraft.adults, children: res.bookingDraft.children })}
                {res.bookingDraft.preferredDate ? ` · ${res.bookingDraft.preferredDate}` : ""}
              </p>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t("toolCalls", { count: res.toolCalls.length })}</h3>
              {res.toolCalls.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">{t("noToolCalls")}</p>
              ) : (
                <ol className="mt-1 space-y-1.5">
                  {res.toolCalls.map((c, i) => (
                    <li key={i} className="rounded-sm border border-line px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-xs font-bold text-lapis-deep">{c.tool}</code>
                        <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-bold", c.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{c.ok ? t("toolOk") : t("toolFailed")}</span>
                        {c.resultCount != null && <span className="text-xs text-ink-muted">{t("results", { count: c.resultCount })}</span>}
                      </div>
                      <p className="mt-1 break-words font-mono text-[0.72rem] text-ink-muted">{prettyInput(c.input)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {run.promptId && (
              <p className="border-l-2 border-saffron bg-saffron-soft/30 px-3 py-2 text-sm">
                <span className="font-semibold">{t("check")}:</span> {tp(`${run.promptId}.check`)}
              </p>
            )}

            <a href={`/admin/ai/${res.conversationId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-cobalt underline">
              {t("openLog")} <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </>
        )}
      </div>
    </article>
  );
}
