import assert from "node:assert/strict";
import test from "node:test";

import {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  createGoogleProvider,
  google,
  registerGoogleProvider,
} from "../packages/google/dist/index.js";

test("Google provider exposes LangChain-backed API-key metadata", () => {
  const provider = createGoogleProvider({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI });

  assert.equal(provider.id, "google");
  assert.equal(provider.displayName, "Google Gemini");
  assert.deepEqual(provider.metadata, {
    id: "google",
    displayName: "Google Gemini",
    backing: "langchain",
    authModes: ["api-key"],
    supportsModelDiscovery: false,
    supportsConnectionTest: false,
    runtimeOptions: [
      {
        id: "temperature",
        type: "number",
        displayName: "Temperature",
        category: "sampling",
        min: 0,
        max: 2,
        step: 0.01,
      },
      {
        id: "maxOutputTokens",
        type: "integer",
        displayName: "Max output tokens",
        category: "output",
        min: 1,
        step: 1,
      },
    ],
  });

  const metadata = getProviderMetadata(provider);
  assert.equal(metadata.id, "google");
  assert.equal(metadata.displayName, "Google Gemini");
  assert.equal(metadata.backing, "langchain");
  assert.deepEqual(metadata.authModes, ["api-key"]);
  assert.equal(metadata.supportsModelDiscovery, false);
  assert.equal(metadata.supportsConnectionTest, false);
  assert.deepEqual(
    metadata.runtimeOptions.map((option) => option.id),
    ["temperature", "maxOutputTokens"],
  );
  assert.notEqual(metadata.runtimeOptions, provider.metadata.runtimeOptions);
});

test("google factory creates a provider alias", () => {
  const provider = google({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI });

  assert.equal(provider.id, "google");
  assert.equal(provider.displayName, "Google Gemini");
});

test("Google provider creates a LangChain-backed model with constructor override", async () => {
  FakeChatGoogleGenerativeAI.instances = [];

  const registry = new ProviderRegistry();
  registry.register(createGoogleProvider({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI }));

  const model = await createModel(
    {
      provider: "google",
      model: "gemini-test",
      apiKey: "test-key",
      temperature: 0.3,
      maxOutputTokens: 128,
    },
    undefined,
    registry,
  );

  assert.equal(FakeChatGoogleGenerativeAI.instances.length, 1);
  assert.deepEqual(FakeChatGoogleGenerativeAI.instances[0].fields, {
    model: "gemini-test",
    apiKey: "test-key",
    temperature: 0.3,
    maxOutputTokens: 128,
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    maxOutputTokens: 64,
    providerOptions: { topP: 0.9 },
  });

  assert.equal(model.id, "gemini-test");
  assert.equal(model.provider, "google");
  assert.equal(model.capabilities.vision, true);
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "provider-native");
  assert.equal(result.text, "hello from fake google");
  assert.deepEqual(FakeChatGoogleGenerativeAI.instances[0].calls[0].messages, [
    { role: "human", type: "human", content: "Hello" },
  ]);
  assert.deepEqual(FakeChatGoogleGenerativeAI.instances[0].calls[0].options, {
    signal: undefined,
    temperature: 0.2,
    maxTokens: 64,
    maxOutputTokens: 64,
    stop: undefined,
    tools: undefined,
    responseFormat: undefined,
    providerOptions: { topP: 0.9 },
    topP: 0.9,
  });
});

test("Google provider validates apiKey", async () => {
  const registry = new ProviderRegistry();
  registry.register(createGoogleProvider({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI }));

  await assert.rejects(
    () =>
      createModel(
        {
          provider: "google",
          model: "gemini-test",
        },
        undefined,
        registry,
      ),
    (error) => {
      assert.equal(error.code, "AUTHENTICATION_ERROR");
      assert.equal(error.provider, "google");
      assert.equal(error.model, "gemini-test");
      assert.equal(error.retryable, false);
      assert.match(error.message, /requires an apiKey/);
      return true;
    },
  );
});

test("Google provider registers globally", async () => {
  globalProviderRegistry.clear();
  FakeChatGoogleGenerativeAI.instances = [];

  registerGoogleProvider({ ChatGoogleGenerativeAI: FakeChatGoogleGenerativeAI });

  const model = await createModel({
    provider: "google",
    model: "gemini-test",
    apiKey: "test-key",
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(result.text, "hello from fake google");
});

class FakeChatGoogleGenerativeAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    this.calls = [];
    FakeChatGoogleGenerativeAI.instances.push(this);
  }

  async invoke(messages, options) {
    this.calls.push({ messages, options });
    return {
      content: "hello from fake google",
      response_metadata: { finish_reason: "stop" },
    };
  }

  async *stream() {
    yield { content: "hello" };
  }
}
