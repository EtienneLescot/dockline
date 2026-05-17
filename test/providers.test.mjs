import assert from "node:assert/strict";
import test from "node:test";

import {
  anthropic,
  copilot,
  google,
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

test("@dockline/providers exports planned provider placeholders", async () => {
  const provider = google();
  assert.equal(provider.id, "google");
  assert.equal(provider.displayName, "Google Gemini");
  assert.equal(provider.metadata.backing, "langchain");
  assert.deepEqual(provider.metadata.authModes, ["api-key"]);

  await assert.rejects(
    provider.createModel({ provider: "google", model: "gemini-placeholder" }),
    /Google Gemini provider is planned but not implemented yet/,
  );

  assert.deepEqual(
    await provider.testConnection?.({ provider: "google", model: "gemini-placeholder" }),
    {
      ok: false,
      status: "unsupported",
      provider: "google",
      model: "gemini-placeholder",
      message: "Google Gemini provider is planned but not implemented yet.",
      retryable: false,
    },
  );
});

test("@dockline/providers delegates openai and anthropic to implemented packages", async () => {
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
