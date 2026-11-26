import "server-only";

/**
 * Provider-independent AI layer: Website UI → /api/ai/chat → runAgent() → ProviderAdapter → model.
 * Each adapter owns its wire format (Gemini contents/parts, OpenAI-style messages for Mistral, OpenRouter,
 * Cerebras, Groq or any compatible endpoint) and runs
 * the tool-calling loop itself, so switching providers never touches the rest of the app.
 * API keys are read from process.env on the server only.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema (OpenAPI subset) for the arguments. */
  parameters: Record<string, unknown>;
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface RunInput {
  system: string;
  history: ChatTurn[];
  tools: ToolSpec[];
  execute: ToolExecutor;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Ask for a JSON object answer (planner). */
  json?: boolean;
  maxToolRounds?: number;
}

export interface RunResult {
  text: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  toolCalls: { name: string; args: Record<string, unknown> }[];
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public kind: "quota" | "unavailable" | "timeout" | "bad_response" | "not_configured" | "blocked",
    message: string,
  ) {
    super(message);
  }
}

export interface ProviderAdapter {
  id: string;
  model: string;
  configured(): boolean;
  run(input: RunInput): Promise<RunResult>;
}

async function postJson(provider: string, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (res.status === 429) throw new ProviderError(provider, "quota", `429 ${text.slice(0, 200)}`);
    if (res.status >= 500) throw new ProviderError(provider, "unavailable", `${res.status} ${text.slice(0, 200)}`);
    if (!res.ok) throw new ProviderError(provider, "bad_response", `${res.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if ((err as Error).name === "AbortError") throw new ProviderError(provider, "timeout", `timeout after ${timeoutMs} ms`);
    throw new ProviderError(provider, "unavailable", (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

// ── Google Gemini (generateContent with function calling) ──────────────────

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thoughtSignature?: string; thought?: boolean };

export function geminiAdapter(model = env("GEMINI_MODEL") || "gemini-flash-lite-latest"): ProviderAdapter {
  return {
    id: "gemini",
    model,
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    async run(input) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new ProviderError("gemini", "not_configured", "GEMINI_API_KEY is not set");
      const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = input.history.map((t) => ({
        role: t.role === "user" ? "user" : "model",
        parts: [{ text: t.content }],
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let tokensIn = 0;
      let tokensOut = 0;
      let usedModel = model;
      const toolCalls: RunResult["toolCalls"] = [];
      const rounds = input.maxToolRounds ?? 4;
      for (let round = 0; round <= rounds; round++) {
        const body: Record<string, unknown> = {
          systemInstruction: { parts: [{ text: input.system }] },
          contents,
          generationConfig: {
            temperature: input.temperature,
            maxOutputTokens: input.maxOutputTokens + 2048, // thinking tokens count against the limit
            ...(input.json ? { responseMimeType: "application/json" } : {}),
          },
          safetySettings: [],
        };
        if (input.tools.length && round < rounds) {
          body.tools = [{ functionDeclarations: input.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
        }
        const data = await postJson("gemini", url, { "x-goog-api-key": key }, body, input.timeoutMs);
        usedModel = data.modelVersion || usedModel;
        tokensIn += data.usageMetadata?.promptTokenCount ?? 0;
        tokensOut += (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);
        const cand = data.candidates?.[0];
        if (!cand) {
          const reason = data.promptFeedback?.blockReason;
          throw new ProviderError("gemini", reason ? "blocked" : "bad_response", reason || "no candidates");
        }
        const parts: GeminiPart[] = cand.content?.parts ?? [];
        const calls = parts.filter((p) => p.functionCall);
        if (calls.length === 0) {
          const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
          return { text, provider: "gemini", model: usedModel, tokensIn, tokensOut, toolCalls };
        }
        contents.push({ role: "model", parts });
        const responses: GeminiPart[] = [];
        for (const p of calls) {
          const name = p.functionCall!.name;
          const args = p.functionCall!.args ?? {};
          toolCalls.push({ name, args });
          const result = await input.execute(name, args);
          responses.push({ functionResponse: { name, response: { result } } });
        }
        contents.push({ role: "user", parts: responses });
      }
      throw new ProviderError("gemini", "bad_response", "too many tool rounds");
    },
  };
}

// ── OpenAI-compatible chat completions (Mistral, OpenRouter, Cerebras, Groq, any custom endpoint) ──

interface CompatSpec {
  id: string;
  /** Base URL up to and including /v1 (".../chat/completions" is appended). */
  baseUrl: () => string | undefined;
  apiKey: () => string | undefined;
  defaultModel: () => string | undefined;
  headers?: () => Record<string, string>;
  /** Mistral expects the function name on tool-result messages. */
  toolResultName?: boolean;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

export const COMPAT_PROVIDERS = {
  mistral: {
    id: "mistral",
    baseUrl: () => "https://api.mistral.ai/v1",
    apiKey: () => env("MISTRAL_API_KEY"),
    defaultModel: () => env("MISTRAL_MODEL") || "mistral-small-latest",
    toolResultName: true,
  },
  openrouter: {
    id: "openrouter",
    baseUrl: () => "https://openrouter.ai/api/v1",
    apiKey: () => env("OPENROUTER_API_KEY"),
    defaultModel: () => env("OPENROUTER_MODEL") || "openrouter/free",
    headers: () => ({ "HTTP-Referer": env("SITE_URL") || "https://nationaltours.uz", "X-Title": "National Tours" }),
  },
  cerebras: {
    id: "cerebras",
    baseUrl: () => "https://api.cerebras.ai/v1",
    apiKey: () => env("CEREBRAS_API_KEY"),
    defaultModel: () => env("CEREBRAS_MODEL") || "gpt-oss-120b",
  },
  groq: {
    id: "groq",
    baseUrl: () => "https://api.groq.com/openai/v1",
    apiKey: () => env("GROQ_API_KEY"),
    defaultModel: () => env("GROQ_MODEL") || "llama-3.3-70b-versatile",
  },
  /** Any other OpenAI-compatible service: set AI_COMPAT_BASE_URL, AI_COMPAT_API_KEY and AI_COMPAT_MODEL. */
  custom: {
    id: "custom",
    baseUrl: () => env("AI_COMPAT_BASE_URL")?.replace(/\/+$/, "").replace(/\/chat\/completions$/, ""),
    apiKey: () => env("AI_COMPAT_API_KEY"),
    defaultModel: () => env("AI_COMPAT_MODEL"),
  },
} satisfies Record<string, CompatSpec>;

export function openAiCompatAdapter(spec: CompatSpec, modelOverride?: string): ProviderAdapter {
  const model = modelOverride || spec.defaultModel() || "";
  return {
    id: spec.id,
    model,
    configured: () => Boolean(spec.apiKey() && spec.baseUrl() && model),
    async run(input) {
      const key = spec.apiKey();
      const base = spec.baseUrl();
      if (!key || !base || !model) throw new ProviderError(spec.id, "not_configured", `${spec.id} is not configured`);
      type Msg = { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string };
      const messages: Msg[] = [{ role: "system", content: input.system }, ...input.history.map((t) => ({ role: t.role, content: t.content }))];
      let tokensIn = 0;
      let tokensOut = 0;
      const toolCalls: RunResult["toolCalls"] = [];
      const rounds = input.maxToolRounds ?? 4;
      for (let round = 0; round <= rounds; round++) {
        const body: Record<string, unknown> = {
          model,
          messages,
          temperature: input.temperature,
          max_tokens: input.maxOutputTokens,
          ...(input.json ? { response_format: { type: "json_object" } } : {}),
        };
        if (input.tools.length && round < rounds) {
          body.tools = input.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
          body.tool_choice = "auto";
        }
        const data = await postJson(spec.id, `${base}/chat/completions`, { authorization: `Bearer ${key}`, ...(spec.headers?.() ?? {}) }, body, input.timeoutMs);
        if (data.error) throw new ProviderError(spec.id, "bad_response", JSON.stringify(data.error).slice(0, 300));
        tokensIn += data.usage?.prompt_tokens ?? 0;
        tokensOut += data.usage?.completion_tokens ?? 0;
        const msg = data.choices?.[0]?.message;
        if (!msg) throw new ProviderError(spec.id, "bad_response", "no choices");
        const calls = (msg.tool_calls ?? []) as { id: string; function: { name: string; arguments: string | Record<string, unknown> } }[];
        if (calls.length === 0) {
          const text = (typeof msg.content === "string" ? msg.content : "").trim();
          if (!text) throw new ProviderError(spec.id, "bad_response", "empty answer");
          return { text, provider: spec.id, model: data.model || model, tokensIn, tokensOut, toolCalls };
        }
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
        for (const c of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = typeof c.function.arguments === "string" ? JSON.parse(c.function.arguments || "{}") : (c.function.arguments ?? {});
          } catch {
            args = {};
          }
          toolCalls.push({ name: c.function.name, args });
          const result = await input.execute(c.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: c.id,
            ...(spec.toolResultName ? { name: c.function.name } : {}),
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
      }
      throw new ProviderError(spec.id, "bad_response", "too many tool rounds");
    },
  };
}

/** Kept for callers that still ask for Groq by name. */
export function groqAdapter(model?: string): ProviderAdapter {
  return openAiCompatAdapter(COMPAT_PROVIDERS.groq, model);
}

/** Deterministic test double, selected with AI_PROVIDER=mock (unit tests, offline demos). */
export function mockAdapter(): ProviderAdapter {
  return {
    id: "mock",
    model: "mock-1",
    configured: () => true,
    async run(input) {
      const last = input.history.at(-1)?.content ?? "";
      // Route like a real model would: places for stays and food, tours for everything else.
      const kind = /hotel|mehmonxona|отел|гостиниц/i.test(last) ? "hotel" : /restaurant|restoran|ресторан|plov|osh|плов/i.test(last) ? "restaurant" : null;
      if (kind) {
        const r = (await input.execute("search_places", { kind, query: last })) as { items?: { name: string; url: string }[] };
        const items = (r.items ?? []).slice(0, 3).map((p) => `- [${p.name}](${p.url})`).join("\n");
        return { text: items ? `Here are ${kind === "hotel" ? "hotels" : "restaurants"} from our catalogue (indicative prices):\n${items}` : "I could not find a match.", provider: "mock", model: "mock-1", tokensIn: 0, tokensOut: 0, toolCalls: [{ name: "search_places", args: { kind, query: last } }] };
      }
      const result = (await input.execute("search_tours", { query: last })) as { tours?: { title: string; url: string }[] };
      const list = (result.tours ?? []).slice(0, 3).map((t) => `- [${t.title}](${t.url})`).join("\n");
      return { text: list ? `Here are tours from our catalogue:\n${list}` : "I could not find a matching tour.", provider: "mock", model: "mock-1", tokensIn: 0, tokensOut: 0, toolCalls: [{ name: "search_tours", args: { query: last } }] };
    },
  };
}

export function adapterFor(id: string | undefined, model?: string): ProviderAdapter | null {
  const key = (id || "").toLowerCase().trim();
  if (key === "gemini") return geminiAdapter(model || undefined);
  if (key === "mock") return mockAdapter();
  const name = key === "openai" || key === "openai-compatible" ? "custom" : key;
  const spec = (COMPAT_PROVIDERS as Record<string, CompatSpec>)[name];
  return spec ? openAiCompatAdapter(spec, model || undefined) : null;
}

/** Order in which any other provider with a key is tried after the ones named in the env. */
const AUTO_FALLBACK = ["mistral", "cerebras", "gemini", "openrouter", "groq", "custom"];

/**
 * Primary provider, an optional second model on it, then fallbacks; quota/timeouts/outages fall through
 * to the next one. Every provider that has a key is in the chain, so adding a key is all it takes.
 */
export function providerChain(): ProviderAdapter[] {
  const primaryId = env("AI_PROVIDER") || "gemini";
  const primary = adapterFor(primaryId, env("AI_MODEL"));
  // A second model on the same provider absorbs "high demand" (503) and timeouts on the first.
  const secondModel = env("AI_SECONDARY_MODEL") || (primaryId === "gemini" ? "gemini-flash-latest" : undefined);
  const secondary = secondModel && secondModel !== "none" ? adapterFor(primaryId, secondModel) : null;
  const named = (env("AI_FALLBACK_PROVIDER") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const fallbacks = named.map((id, i) => adapterFor(id, i === 0 ? env("AI_FALLBACK_MODEL") : undefined));
  const auto = primaryId === "mock" ? [] : AUTO_FALLBACK.map((id) => adapterFor(id));
  return [primary, secondary, ...fallbacks, ...auto].filter(
    (a, i, arr): a is ProviderAdapter => !!a && a.configured() && arr.findIndex((b) => b?.id === a.id && b?.model === a.model) === i,
  );
}
