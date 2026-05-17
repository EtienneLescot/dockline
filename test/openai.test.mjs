import assert from "node:assert/strict";
import test from "node:test";
import {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  createOpenAIProvider,
  openai,
  registerOpenAIProvider,
} from "../packages/openai/dist/index.js";

test("OpenAI provider exposes LangChain-backed API-key metadata", () => {
  const provider = createOpenAIProvider({ ChatOpenAI: FakeChatOpenAI });

  assert.equal(provider.id, "openai");
  assert.equal(provider.displayName, "OpenAI");
  assert.deepEqual(provider.metadata, {
    id: "openai",
    displayName: "OpenAI",
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
      {
        id: "reasoningEffort",
        type: "enum",
        displayName: "Reasoning effort",
        category: "reasoning",
        enumValues: [
          { value: "low", displayName: "Low" },
          { value: "medium", displayName: "Medium" },
          { value: "high", displayName: "High" },
        ],
      },
    ],
  });

  const metadata = getProviderMetadata(provider);
  assert.equal(metadata.id, "openai");
  assert.equal(metadata.displayName, "OpenAI");
  assert.equal(metadata.backing, "langchain");
  assert.deepEqual(metadata.authModes, ["api-key"]);
  assert.equal(metadata.supportsModelDiscovery, false);
  assert.equal(metadata.supportsConnectionTest, false);
  assert.deepEqual(
    metadata.runtimeOptions.map((option) => option.id),
    ["temperature", "maxOutputTokens", "reasoningEffort"],
  );
  assert.notEqual(metadata.runtimeOptions, provider.metadata.runtimeOptions);
});

test("openai factory creates a provider alias", () => {
  const provider = openai({ ChatOpenAI: FakeChatOpenAI });

  assert.equal(provider.id, "openai");
  assert.equal(provider.displayName, "OpenAI");
});

test("OpenAI provider creates a LangChain-backed model with constructor override", async () => {
  FakeChatOpenAI.instances = [];

  const registry = new ProviderRegistry();
  registry.register(createOpenAIProvider({ ChatOpenAI: FakeChatOpenAI }));

  const model = await createModel(
    {
      provider: "openai",
      model: "gpt-test",
      apiKey: "test-key",
      baseURL: "https://api.example.test/v1",
      organization: "org-test",
      project: "proj-test",
      temperature: 0.3,
      maxOutputTokens: 128,
      reasoningEffort: "high",
    },
    undefined,
    registry,
  );

  assert.equal(FakeChatOpenAI.instances.length, 1);
  assert.deepEqual(FakeChatOpenAI.instances[0].fields, {
    model: "gpt-test",
    apiKey: "test-key",
    temperature: 0.3,
    maxTokens: 128,
    maxOutputTokens: 128,
    configuration: {
      baseURL: "https://api.example.test/v1",
      organization: "org-test",
      project: "proj-test",
    },
    reasoning: {
      effort: "high",
    },
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.2,
    maxOutputTokens: 64,
    providerOptions: { topP: 0.9 },
  });

  assert.equal(model.id, "gpt-test");
  assert.equal(model.provider, "openai");
  assert.equal(model.capabilities.vision, true);
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "provider-native");
  assert.equal(result.text, "hello from fake openai");
  assert.deepEqual(FakeChatOpenAI.instances[0].calls[0].options, {
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

test("OpenAI provider validates apiKey", async () => {
  const registry = new ProviderRegistry();
  registry.register(createOpenAIProvider({ ChatOpenAI: FakeChatOpenAI }));

  await assert.rejects(
    () =>
      createModel(
        {
          provider: "openai",
          model: "gpt-test",
        },
        undefined,
        registry,
      ),
    (error) => {
      assert.equal(error.code, "AUTHENTICATION_ERROR");
      assert.equal(error.provider, "openai");
      assert.equal(error.model, "gpt-test");
      assert.equal(error.retryable, false);
      assert.match(error.message, /requires an apiKey/);
      return true;
    },
  );
});

test("OpenAI provider registers globally", async () => {
  globalProviderRegistry.clear();
  FakeChatOpenAI.instances = [];

  registerOpenAIProvider({ ChatOpenAI: FakeChatOpenAI });

  const model = await createModel({
    provider: "openai",
    model: "gpt-test",
    apiKey: "test-key",
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(result.text, "hello from fake openai");
});

class FakeChatOpenAI {
  static instances = [];

  constructor(fields) {
    this.fields = fields;
    this.calls = [];
    FakeChatOpenAI.instances.push(this);
  }

  async invoke(messages, options) {
    this.calls.push({ messages, options });
    return {
      content: "hello from fake openai",
      response_metadata: { finish_reason: "stop" },
    };
  }

  async *stream() {
    yield { content: "hello" };
  }
}
