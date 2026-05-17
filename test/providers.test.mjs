import assert from "node:assert/strict";
import test from "node:test";

import {
  alibaba,
  anthropic,
  copilot,
  deepseek,
  google,
  mistral,
  minimax,
  moonshot,
  openai,
  openaiCompatible,
  openaiOAuth,
  openrouter,
} from "../packages/providers/dist/index.js";

test("@dockline/providers exports implemented provider factories", () => {
  const router = openrouter();
  assert.equal(router.id, "openrouter");
  assert.equal(router.displayName, "OpenRouter");
  assert.deepEqual(router.metadata.authModes, ["api-key"]);
  assert.equal(router.metadata.supportsModelDiscovery, true);
  assert.equal(typeof router.createModel, "function");

  const compatible = openaiCompatible({
    id: "local-openai",
    displayName: "Local OpenAI-compatible",
    baseURL: "http://localhost:1234/v1",
  });
  assert.equal(compatible.id, "local-openai");
  assert.equal(compatible.displayName, "Local OpenAI-compatible");
  assert.equal(compatible.metadata.backing, "openai-compatible");
});

test("@dockline/providers exports OpenAI-compatible provider presets", async () => {
  const provider = minimax();
  assert.equal(provider.id, "minimax");
  assert.equal(provider.displayName, "MiniMax");
  assert.equal(provider.metadata.backing, "openai-compatible");
  assert.deepEqual(provider.metadata.authModes, ["api-key"]);
  assert.equal(provider.metadata.supportsModelDiscovery, true);
  assert.equal(provider.metadata.supportsConnectionTest, true);

  const model = await provider.createModel({
    provider: "minimax",
    model: "MiniMax-M2.7",
    apiKey: "test-key",
  });

  assert.equal(model.provider, "minimax");
  assert.equal(model.id, "MiniMax-M2.7");
  assert.equal(model.capabilities.reasoning, true);

  assert.equal(deepseek().metadata.backing, "openai-compatible");
  assert.equal(deepseek().metadata.supportsModelDiscovery, true);
  assert.equal(moonshot().displayName, "Moonshot AI / Kimi");
  assert.equal(alibaba().displayName, "Alibaba/Qwen");
});

test("@dockline/providers presets allow base URL overrides", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: [{ id: "qwen-test" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const provider = alibaba({ baseURL: "https://example.test/compatible-mode/v1" });

  try {
    const result = await provider.testConnection?.({
      provider: "alibaba",
      model: "qwen-test",
      apiKey: "test-key",
    });

    assert.equal(result.ok, true);
    assert.equal(result.provider, "alibaba");
    assert.equal(result.model, "qwen-test");
    assert.deepEqual(urls, ["https://example.test/compatible-mode/v1/models"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("@dockline/providers delegates implemented factories to provider packages", async () => {
  const openaiProvider = openai({ ChatOpenAI: FakeChatOpenAI });
  assert.equal(openaiProvider.id, "openai");
  assert.equal(openaiProvider.displayName, "OpenAI");
  assert.equal(openaiProvider.metadata.supportsConnectionTest, false);

  await openaiProvider.createModel({
    provider: "openai",
    model: "gpt-test",
    apiKey: "test-key",
  });
  assert.deepEqual(FakeChatOpenAI.instances.at(-1).fields, {
    model: "gpt-test",
    apiKey: "test-key",
  });

  const anthropicProvider = anthropic({ ChatAnthropic: FakeChatAnthropic });
  assert.equal(anthropicProvider.id, "anthropic");
  assert.equal(anthropicProvider.displayName, "Anthropic");
  assert.equal(anthropicProvider.metadata.supportsConnectionTest, false);

  await anthropicProvider.createModel({
    provider: "anthropic",
    model: "claude-test",
    apiKey: "test-key",
  });
  assert.deepEqual(FakeChatAnthropic.instances.at(-1).fields, {
    model: "claude-test",
    apiKey: "test-key",
    temperature: undefined,
    maxTokens: undefined,
  });

  const googleProvider = google({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI });
  assert.equal(googleProvider.id, "google");
  assert.equal(googleProvider.displayName, "Google Gemini");
  assert.equal(googleProvider.metadata.supportsConnectionTest, false);

  await googleProvider.createModel({
    provider: "google",
    model: "gemini-test",
    apiKey: "test-key",
  });
  assert.deepEqual(FakeChatGoogleGenerativeAI.instances.at(-1).fields, {
    model: "gemini-test",
    apiKey: "test-key",
  });

  const mistralProvider = mistral({ ChatMistralAI: FakeChatMistralAI });
  assert.equal(mistralProvider.id, "mistral");
  assert.equal(mistralProvider.displayName, "Mistral");
  assert.equal(mistralProvider.metadata.supportsConnectionTest, false);

  await mistralProvider.createModel({
    provider: "mistral",
    model: "mistral-test",
    apiKey: "test-key",
  });
  assert.deepEqual(FakeChatMistralAI.instances.at(-1).fields, {
    model: "mistral-test",
    apiKey: "test-key",
  });
});

test("@dockline/providers exports openai variants separately", () => {
  assert.equal(openaiOAuth().id, "openai-oauth");
  assert.deepEqual(openaiOAuth().metadata.authModes, ["oauth", "device-code"]);
  assert.deepEqual(copilot().metadata.authModes, ["device-code", "environment"]);
});

class FakeChatOpenAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    FakeChatOpenAI.instances.push(this);
  }

  async invoke() {
    return { content: "ok" };
  }

  async *stream() {
    yield { content: "ok" };
  }
}

class FakeChatAnthropic {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    FakeChatAnthropic.instances.push(this);
  }

  async invoke() {
    return { content: "ok" };
  }

  async *stream() {
    yield { content: "ok" };
  }
}

class FakeChatGoogleGenerativeAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    FakeChatGoogleGenerativeAI.instances.push(this);
  }

  async invoke() {
    return { content: "ok" };
  }

  async *stream() {
    yield { content: "ok" };
  }
}

class FakeChatMistralAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    FakeChatMistralAI.instances.push(this);
  }

  async invoke() {
    return { content: "ok" };
  }

  async *stream() {
    yield { content: "ok" };
  }
}
