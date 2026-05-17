import assert from "node:assert/strict";
import test from "node:test";

import {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  anthropic,
  createAnthropicProvider,
  registerAnthropicProvider,
} from "../packages/anthropic/dist/index.js";

test("Anthropic provider exposes LangChain-backed api-key metadata", () => {
  const provider = anthropic({ ChatAnthropic: FakeChatAnthropic });

  assert.equal(provider.id, "anthropic");
  assert.equal(provider.displayName, "Anthropic");
  assert.deepEqual(provider.metadata, {
    id: "anthropic",
    displayName: "Anthropic",
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
  assert.equal(metadata.id, "anthropic");
  assert.equal(metadata.displayName, "Anthropic");
  assert.equal(metadata.backing, "langchain");
  assert.deepEqual(metadata.authModes, ["api-key"]);
  assert.equal(metadata.supportsModelDiscovery, false);
  assert.equal(metadata.supportsConnectionTest, false);
  assert.deepEqual(
    metadata.runtimeOptions.map((option) => option.id),
    ["temperature", "maxOutputTokens"],
  );
});

test("Anthropic registers globally and creates a LangChain bridge with constructor override", async () => {
  FakeChatAnthropic.instances.length = 0;
  registerAnthropicProvider({ ChatAnthropic: FakeChatAnthropic });

  const provider = globalProviderRegistry.get("anthropic");
  assert.equal(provider.id, "anthropic");
  assert.equal(provider.displayName, "Anthropic");

  const model = await createModel({
    provider: "anthropic",
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    temperature: 0.2,
    maxOutputTokens: 128,
  });

  assert.equal(model.id, "claude-3-5-sonnet-latest");
  assert.equal(model.provider, "anthropic");
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "provider-native");
  assert.equal(model.capabilities.textGeneration, true);
  assert.equal(model.capabilities.streaming, true);
  assert.equal(model.capabilities.toolCalling, true);
  assert.equal(model.capabilities.structuredOutput, true);

  assert.equal(FakeChatAnthropic.instances.length, 1);
  assert.deepEqual(FakeChatAnthropic.instances[0].fields, {
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-key",
    temperature: 0.2,
    maxTokens: 128,
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.4,
    maxOutputTokens: 64,
  });

  assert.deepEqual(FakeChatAnthropic.instances[0].invocations[0].messages, [
    { role: "human", type: "human", content: "Hello" },
  ]);
  assert.equal(FakeChatAnthropic.instances[0].invocations[0].options.temperature, 0.4);
  assert.equal(FakeChatAnthropic.instances[0].invocations[0].options.maxTokens, 64);
  assert.equal(result.text, "Hello from fake Anthropic");
});

test("Anthropic createModel validates that apiKey is required", async () => {
  const registry = new ProviderRegistry();
  registry.register(createAnthropicProvider({ ChatAnthropic: FakeChatAnthropic }));

  await assert.rejects(
    () =>
      createModel(
        {
          provider: "anthropic",
          model: "claude-3-haiku",
        },
        undefined,
        registry,
      ),
    (error) => {
      assert.equal(error.code, "AUTHENTICATION_ERROR");
      assert.equal(error.provider, "anthropic");
      assert.equal(error.model, "claude-3-haiku");
      assert.equal(error.retryable, false);
      assert.match(error.message, /requires an apiKey/);
      return true;
    },
  );
});

class FakeChatAnthropic {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    this.invocations = [];
    FakeChatAnthropic.instances.push(this);
  }

  async invoke(messages, options) {
    this.invocations.push({ messages, options });
    return {
      content: "Hello from fake Anthropic",
      response_metadata: { finish_reason: "stop" },
      usage_metadata: {
        input_tokens: 3,
        output_tokens: 4,
        total_tokens: 7,
      },
    };
  }

  async *stream() {
    yield { content: "Hello" };
  }
}
