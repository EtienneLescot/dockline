import assert from "node:assert/strict";
import test from "node:test";
import {
  createModel,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import { OpenAICompatibleChatModel } from "../packages/openai-compatible/dist/index.js";
import {
  createOpenRouterProvider,
  registerOpenRouterProvider,
  OPENROUTER_BASE_URL,
} from "../packages/openrouter/dist/index.js";

test("OpenRouter registers globally and creates an OpenAI-compatible model", async () => {
  registerOpenRouterProvider();

  const provider = globalProviderRegistry.get("openrouter");
  assert.equal(provider.id, "openrouter");
  assert.equal(provider.displayName, "OpenRouter");

  const model = await createModel({
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    apiKey: "test-key",
  });

  assert.equal(model.id, "openai/gpt-4o-mini");
  assert.equal(model.provider, "openrouter");
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "json-schema");
  assert.equal(model.capabilities.textGeneration, true);
  assert.equal(model.capabilities.toolCalling, true);
  assert.equal(model.capabilities.structuredOutput, true);
  assert.equal(model.capabilities.vision, true);
  assert.equal(model instanceof OpenAICompatibleChatModel, true);
});

test("OpenRouter createModel validates that apiKey is required", async () => {
  const registry = new ProviderRegistry();
  registry.register(createOpenRouterProvider());

  await assert.rejects(
    () =>
      createModel(
        {
          provider: "openrouter",
          model: "openai/gpt-4o-mini",
        },
        undefined,
        registry,
      ),
    (error) => {
      assert.equal(error.code, "AUTHENTICATION_ERROR");
      assert.equal(error.provider, "openrouter");
      assert.equal(error.model, "openai/gpt-4o-mini");
      assert.equal(error.retryable, false);
      assert.match(error.message, /requires an apiKey/);
      return true;
    },
  );
});

test("OpenRouter sends requests to the OpenRouter base URL with provider headers", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Hello from OpenRouter",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 3,
          total_tokens: 7,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const registry = new ProviderRegistry();
    registry.register(createOpenRouterProvider());

    const model = await createModel(
      {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        apiKey: "openrouter-key",
        baseURL: "https://example.invalid/should-not-be-used",
        headers: {
          "X-Custom": "custom-value",
        },
        appName: "Dockline Tests",
        appURL: "https://dockline.example",
      },
      undefined,
      registry,
    );

    const result = await model.generate({
      messages: [{ role: "user", content: "Hello" }],
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `${OPENROUTER_BASE_URL}/chat/completions`);
    assert.equal(requests[0].init.method, "POST");
    assert.equal(requests[0].init.headers.authorization, "Bearer openrouter-key");
    assert.equal(requests[0].init.headers["content-type"], "application/json");
    assert.equal(requests[0].init.headers["X-Custom"], "custom-value");
    assert.equal(requests[0].init.headers["X-Title"], "Dockline Tests");
    assert.equal(requests[0].init.headers["HTTP-Referer"], "https://dockline.example");

    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.model, "anthropic/claude-3.5-sonnet");
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [{ role: "user", content: "Hello" }]);

    assert.deepEqual(result, {
      text: "Hello from OpenRouter",
      toolCalls: undefined,
      usage: {
        inputTokens: 4,
        outputTokens: 3,
        totalTokens: 7,
      },
      finishReason: "stop",
      raw: {
        choices: [
          {
            message: {
              content: "Hello from OpenRouter",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 3,
          total_tokens: 7,
        },
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
