import assert from "node:assert/strict";
import test from "node:test";

import {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  createMistralProvider,
  mistral,
  registerMistralProvider,
} from "../packages/mistral/dist/index.js";

test("Mistral provider exposes LangChain-backed api-key metadata", () => {
  const provider = mistral({ ChatMistralAI: FakeChatMistralAI });

  assert.equal(provider.id, "mistral");
  assert.equal(provider.displayName, "Mistral");
  assert.deepEqual(provider.metadata, {
    id: "mistral",
    displayName: "Mistral",
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
        max: 1,
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
  assert.equal(metadata.id, "mistral");
  assert.equal(metadata.displayName, "Mistral");
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

test("mistral factory creates a provider alias", () => {
  const provider = mistral({ ChatMistralAI: FakeChatMistralAI });

  assert.equal(provider.id, "mistral");
  assert.equal(provider.displayName, "Mistral");
});

test("Mistral provider creates a LangChain-backed model with constructor override", async () => {
  FakeChatMistralAI.instances = [];

  const registry = new ProviderRegistry();
  registry.register(createMistralProvider({ ChatMistralAI: FakeChatMistralAI }));

  const model = await createModel(
    {
      provider: "mistral",
      model: "mistral-large-test",
      apiKey: "test-key",
      temperature: 0.3,
      maxOutputTokens: 128,
    },
    undefined,
    registry,
  );

  assert.equal(FakeChatMistralAI.instances.length, 1);
  assert.deepEqual(FakeChatMistralAI.instances[0].fields, {
    model: "mistral-large-test",
    apiKey: "test-key",
    temperature: 0.3,
    maxTokens: 128,
    maxOutputTokens: 128,
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    maxOutputTokens: 64,
  });

  assert.equal(model.id, "mistral-large-test");
  assert.equal(model.provider, "mistral");
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "provider-native");
  assert.equal(result.text, "hello from fake mistral");
  assert.deepEqual(FakeChatMistralAI.instances[0].calls[0].messages, [
    { role: "human", type: "human", content: "Hello" },
  ]);
  assert.equal(FakeChatMistralAI.instances[0].calls[0].options.temperature, 0.2);
  assert.equal(FakeChatMistralAI.instances[0].calls[0].options.maxTokens, 64);
});

test("Mistral provider validates apiKey", async () => {
  const registry = new ProviderRegistry();
  registry.register(createMistralProvider({ ChatMistralAI: FakeChatMistralAI }));

  await assert.rejects(
    () =>
      createModel(
        {
          provider: "mistral",
          model: "mistral-small-test",
        },
        undefined,
        registry,
      ),
    (error) => {
      assert.equal(error.code, "AUTHENTICATION_ERROR");
      assert.equal(error.provider, "mistral");
      assert.equal(error.model, "mistral-small-test");
      assert.equal(error.retryable, false);
      assert.match(error.message, /requires an apiKey/);
      return true;
    },
  );
});

test("Mistral provider registers globally", async () => {
  globalProviderRegistry.clear();
  FakeChatMistralAI.instances = [];

  registerMistralProvider({ ChatMistralAI: FakeChatMistralAI });

  const model = await createModel({
    provider: "mistral",
    model: "mistral-small-test",
    apiKey: "test-key",
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(result.text, "hello from fake mistral");
});

class FakeChatMistralAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    this.calls = [];
    FakeChatMistralAI.instances.push(this);
  }

  async invoke(messages, options) {
    this.calls.push({ messages, options });
    return {
      content: "hello from fake mistral",
      response_metadata: { finish_reason: "stop" },
    };
  }

  async *stream() {
    yield { content: "hello" };
  }
}
