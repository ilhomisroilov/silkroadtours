import "server-only";

/**
 * Provider-independent AI layer: Website UI → /api/ai/chat → runAgent() → ProviderAdapter → model.
 * Each adapter owns its wire format (Gemini contents/parts, OpenAI-style messages for Groq) and runs
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

export function geminiAdapter(model = process.env.AI_MODEL || "gemini-flash-lite-latest"): ProviderAdapter {
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

// ── Groq (OpenAI-compatible chat completions) ──────────────────────────────

export function groqAdapter(model = process.env.AI_FALLBACK_MODEL || "llama-3.3-70b-versatile"): ProviderAdapter {
  return {
    id: "groq",
    model,
    configured: () => Boolean(process.env.GROQ_API_KEY),
    async run(input) {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new ProviderError("groq", "not_configured", "GROQ_API_KEY is not set");
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
        }
        const data = await postJson("groq", "https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${key}` }, body, input.timeoutMs);
        tokensIn += data.usage?.prompt_tokens ?? 0;
        tokensOut += data.usage?.completion_tokens ?? 0;
        const msg = data.choices?.[0]?.message;
        if (!msg) throw new ProviderError("groq", "bad_response", "no choices");
        const calls = (msg.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[];
        if (calls.length === 0) return { text: (msg.content ?? "").trim(), provider: "groq", model: data.model || model, tokensIn, tokensOut, toolCalls };
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
        for (const c of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(c.function.arguments || "{}");
          } catch {
            args = {};
          }
          toolCalls.push({ name: c.function.name, args });
          const result = await input.execute(c.function.name, args);
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 12000) });
        }
      }
      throw new ProviderError("groq", "bad_response", "too many tool rounds");
    },
  };
}

/** Deterministic test double, selected with AI_PROVIDER=mock (unit tests, offline demos). */
export function mockAdapter(): ProviderAdapter {
  return {
    id: "mock",
    model: "mock-1",
    configured: () => true,
    async run(input) {
      const last = input.history.at(-1)?.content ?? "";
      const result = (await input.execute("search_tours", { query: last })) as { tours?: { title: string; url: string }[] };
      const list = (result.tours ?? []).slice(0, 3).map((t) => `- [${t.title}](${t.url})`).join("\n");
      return { text: list ? `Here are tours from our catalogue:\n${list}` : "I could not find a matching tour.", provider: "mock", model: "mock-1", tokensIn: 0, tokensOut: 0, toolCalls: [{ name: "search_tours", args: { query: last } }] };
    },
  };
}

export function adapterFor(id: string | undefined, model?: string): ProviderAdapter | null {
  switch ((id || "").toLowerCase()) {
    case "gemini":
      return geminiAdapter(model || undefined);
    case "groq":
      return groqAdapter(model || undefined);
    case "mock":
      return mockAdapter();
    default:
      return null;
  }
}

/** Primary provider, then the configured fallback; quota/timeouts/outages fall through to the next one. */
export function providerChain(): ProviderAdapter[] {
  const primary = adapterFor(process.env.AI_PROVIDER || "gemini", process.env.AI_MODEL);
  // A second model on the same provider absorbs "high demand" (503) and timeouts on the first.
  const secondary = process.env.AI_SECONDARY_MODEL === "none" ? null : adapterFor(process.env.AI_PROVIDER || "gemini", process.env.AI_SECONDARY_MODEL || "gemini-flash-latest");
  const fallback = adapterFor(process.env.AI_FALLBACK_PROVIDER || "groq", process.env.AI_FALLBACK_MODEL);
  return [primary, secondary, fallback].filter(
    (a, i, arr): a is ProviderAdapter => !!a && a.configured() && arr.findIndex((b) => b?.id === a.id && b?.model === a.model) === i,
  );
}
