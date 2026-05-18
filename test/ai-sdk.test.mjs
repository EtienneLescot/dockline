import assert from "node:assert/strict";
import test from "node:test";

import {
  createModel,
  globalProviderRegistry,
  ProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  createAISDKChatProvider,
  registerAISDKChatProvider,
} from "../packages/ai-sdk/dist/index.js";

test("AI SDK provider bridge exposes metadata and generates with LanguageModelV3", async () => {
  const fake = new FakeAISDKLanguageModel();
  const provider = createAISDKChatProvider({
    id: "ai-sdk-test",
    displayName: "AI SDK Test",
    metadata: {
      authModes: ["api-key"],
      runtimeOptions: [{ id: "temperature", type: "number", category: "sampling" }],
    },
    createLanguageModel(config) {
      fake.modelId = config.model;
      return fake;
    },
  });

  assert.equal(provider.metadata.backing, "vercel-ai-sdk");
  assert.deepEqual(provider.metadata.authModes, ["api-key"]);
  assert.equal(provider.metadata.runtimeOptions[0].id, "temperature");

  const registry = new ProviderRegistry();
  registry.register(provider);

  const model = await createModel(
    {
      provider: "ai-sdk-test",
      model: "test-model",
      capabilities: { reasoning: true },
    },
    undefined,
    registry,
  );

  const result = await model.generate({
    messages: [
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hello" },
    ],
    tools: [
      {
        name: "lookup",
        description: "Lookup something",
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
      },
    ],
    responseFormat: {
      type: "json-schema",
      name: "answer",
      schema: { type: "object" },
    },
    providerOptions: { openai: { reasoningEffort: "low" } },
  });

  assert.equal(model.provider, "ai-sdk-test");
  assert.equal(model.id, "test-model");
  assert.equal(model.capabilities.reasoning, true);
  assert.equal(model.toolCallingMode, "native");
  assert.equal(model.structuredOutputMode, "json-schema");
  assert.equal(result.text, "hello");
  assert.deepEqual(result.toolCalls, [
    { id: "call-1", name: "lookup", arguments: { query: "dockline" } },
  ]);
  assert.deepEqual(result.usage, {
    inputTokens: 3,
    outputTokens: 4,
    totalTokens: 7,
  });
  assert.equal(result.finishReason, "tool-calls");

  assert.deepEqual(fake.generateCalls[0].prompt, [
    { role: "system", content: "Be concise." },
    { role: "user", content: [{ type: "text", text: "Hello" }] },
  ]);
  assert.equal(fake.generateCalls[0].tools[0].name, "lookup");
  assert.equal(fake.generateCalls[0].responseFormat.type, "json");
  assert.deepEqual(fake.generateCalls[0].providerOptions, {
    openai: { reasoningEffort: "low" },
  });
});

test("AI SDK provider bridge streams text, reasoning, tool calls, usage, and done", async () => {
  const fake = new FakeAISDKLanguageModel();
  const registry = new ProviderRegistry();
  registry.register(createAISDKChatProvider({
    id: "ai-sdk-test",
    createLanguageModel: () => fake,
  }));

  const model = await createModel(
    { provider: "ai-sdk-test", model: "stream-model" },
    undefined,
    registry,
  );

  const events = [];
  for await (const event of model.stream({
    messages: [{ role: "user", content: "stream" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "text-delta", text: "hel" },
    { type: "reasoning-delta", text: "think" },
    {
      type: "tool-call",
      toolCall: { id: "tool-1", name: "lookup", arguments: { query: "dockline" } },
    },
    { type: "usage", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } },
    { type: "done" },
  ]);
});

test("AI SDK provider bridge can register globally", async () => {
  globalProviderRegistry.clear();
  registerAISDKChatProvider({
    id: "ai-sdk-test",
    createLanguageModel: () => new FakeAISDKLanguageModel(),
  });

  const model = await createModel({ provider: "ai-sdk-test", model: "global-model" });
  const result = await model.generate({ messages: [{ role: "user", content: "Hi" }] });

  assert.equal(result.text, "hello");
});

class FakeAISDKLanguageModel {
  specificationVersion = "v3";
  provider = "fake-ai-sdk";
  modelId = "fake-model";
  generateCalls = [];
  streamCalls = [];

  async doGenerate(options) {
    this.generateCalls.push(options);

    return {
      content: [
        { type: "text", text: "hello" },
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "lookup",
          input: "{\"query\":\"dockline\"}",
        },
      ],
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage: {
        inputTokens: { total: 3 },
        outputTokens: { total: 4 },
      },
      warnings: [],
    };
  }

  async doStream(options) {
    this.streamCalls.push(options);

    return {
      stream: streamFrom([
        { type: "text-delta", id: "text-1", delta: "hel" },
        { type: "reasoning-delta", id: "reasoning-1", delta: "think" },
        { type: "tool-input-start", id: "tool-1", toolName: "lookup" },
        { type: "tool-input-delta", id: "tool-1", delta: "{\"query\":" },
        { type: "tool-input-delta", id: "tool-1", delta: "\"dockline\"}" },
        { type: "tool-input-end", id: "tool-1" },
        {
          type: "finish",
          usage: {
            inputTokens: { total: 1 },
            outputTokens: { total: 2 },
          },
          finishReason: { unified: "stop" },
        },
      ]),
    };
  }
}

const streamFrom = (parts) =>
  new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
