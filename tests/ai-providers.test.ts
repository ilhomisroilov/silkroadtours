import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { COMPAT_PROVIDERS, openAiCompatAdapter, providerChain } from "../src/lib/ai/providers";

const AI_ENV = ["AI_PROVIDER", "AI_MODEL", "AI_SECONDARY_MODEL", "AI_FALLBACK_PROVIDER", "AI_FALLBACK_MODEL", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "CEREBRAS_API_KEY", "GROQ_API_KEY", "AI_COMPAT_BASE_URL", "AI_COMPAT_API_KEY", "AI_COMPAT_MODEL"];
const saved = Object.fromEntries(AI_ENV.map((k) => [k, process.env[k]]));
const realFetch = globalThis.fetch;
afterEach(() => {
  for (const k of AI_ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  globalThis.fetch = realFetch;
});
const clear = () => AI_ENV.forEach((k) => delete process.env[k]);

describe("OpenAI-compatible AI providers", () => {
  it("runs the tool loop: tool call, tool result, final answer", async () => {
    clear();
    process.env.MISTRAL_API_KEY = "test-key";
    const bodies: Record<string, unknown>[] = [];
    let url = "";
    let auth = "";
    globalThis.fetch = (async (u: string, init: RequestInit) => {
      url = String(u);
      auth = String((init.headers as Record<string, string>).authorization);
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const reply =
        bodies.length === 1
          ? { choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "abc123XYZ", type: "function", function: { name: "search_tours", arguments: '{"query":"Samarkand"}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }
          : { model: "mistral-small-2603", choices: [{ message: { role: "assistant", content: "Samarkand Day Tour fits." } }], usage: { prompt_tokens: 20, completion_tokens: 7 } };
      return new Response(JSON.stringify(reply), { status: 200 });
    }) as typeof fetch;
    const executed: unknown[] = [];
    const res = await openAiCompatAdapter(COMPAT_PROVIDERS.mistral).run({
      system: "sys",
      history: [{ role: "user", content: "Samarkand?" }],
      tools: [{ name: "search_tours", description: "search", parameters: { type: "object", properties: {} } }],
      execute: async (name, args) => (executed.push({ name, args }), { tours: [{ title: "Samarkand Day Tour" }] }),
      temperature: 0.2,
      maxOutputTokens: 300,
      timeoutMs: 5000,
    });
    assert.equal(url, "https://api.mistral.ai/v1/chat/completions");
    assert.equal(auth, "Bearer test-key");
    assert.deepEqual(executed, [{ name: "search_tours", args: { query: "Samarkand" } }]);
    assert.equal(res.text, "Samarkand Day Tour fits.");
    assert.equal(res.provider, "mistral");
    assert.equal(res.tokensIn, 30);
    assert.equal(res.tokensOut, 12);
    const second = bodies[1]!.messages as { role: string; tool_call_id?: string; name?: string }[];
    const tool = second.at(-1)!;
    assert.equal(tool.role, "tool");
    assert.equal(tool.tool_call_id, "abc123XYZ");
    assert.equal(tool.name, "search_tours");
    assert.equal(second.at(-2)!.role, "assistant");
  });

  it("maps 429 to a quota error so the chain moves on", async () => {
    clear();
    process.env.OPENROUTER_API_KEY = "k";
    globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
    await assert.rejects(
      openAiCompatAdapter(COMPAT_PROVIDERS.openrouter).run({ system: "s", history: [{ role: "user", content: "hi" }], tools: [], execute: async () => ({}), temperature: 0, maxOutputTokens: 10, timeoutMs: 1000 }),
      (e: { kind?: string }) => e.kind === "quota",
    );
  });

  it("puts every provider that has a key into the chain, primary first", () => {
    clear();
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "g";
    process.env.MISTRAL_API_KEY = "m";
    process.env.OPENROUTER_API_KEY = "o";
    const chain = providerChain().map((p) => `${p.id}:${p.model}`);
    assert.deepEqual(chain, ["gemini:gemini-flash-lite-latest", "gemini:gemini-flash-latest", "mistral:mistral-small-latest", "openrouter:openrouter/free"]);
  });

  it("follows the server order Mistral → Cerebras → Gemini → OpenRouter", () => {
    clear();
    Object.assign(process.env, {
      AI_PROVIDER: "mistral",
      AI_MODEL: "",
      AI_SECONDARY_MODEL: "none",
      AI_FALLBACK_PROVIDER: "cerebras,gemini,openrouter",
      AI_FALLBACK_MODEL: "",
      MISTRAL_API_KEY: "m",
      CEREBRAS_API_KEY: "c",
      CEREBRAS_MODEL: "qwen-3.8-27b",
      GEMINI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    });
    assert.deepEqual(
      providerChain().map((p) => `${p.id}:${p.model}`),
      ["mistral:mistral-small-latest", "cerebras:qwen-3.8-27b", "gemini:gemini-flash-lite-latest", "openrouter:openrouter/free"],
    );
    delete process.env.CEREBRAS_MODEL;
  });

  it("supports a custom OpenAI-compatible endpoint as primary", () => {
    clear();
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.AI_COMPAT_BASE_URL = "https://llm.example.com/v1/chat/completions";
    process.env.AI_COMPAT_API_KEY = "c";
    process.env.AI_COMPAT_MODEL = "some-model";
    const chain = providerChain();
    assert.equal(chain[0]!.id, "custom");
    assert.equal(chain[0]!.model, "some-model");
    assert.equal(COMPAT_PROVIDERS.custom.baseUrl(), "https://llm.example.com/v1");
  });

  it("has no providers without keys (the site then answers from the database)", () => {
    clear();
    assert.deepEqual(providerChain(), []);
  });
});
