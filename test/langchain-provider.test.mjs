import assert from "node:assert/strict";
import test from "node:test";
import {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
} from "../packages/core/dist/index.js";
import {
  createLangChainChatProvider,
  registerLangChainChatProvider,
} from "../packages/langchain-provider/dist/index.js";

test("LangChain provider exposes metadata defaults and creates Dockline models", async () => {
  const provider = createLangChainChatProvider({
    id: "fake-langchain",
    displayName: "Fake LangChain",
    metadata: {
      authModes: ["api-key"],
      supportsConnectionTest: true,
    },
    createChatModel(config) {
      assert.equal(config.model, "fake-model");
      return fakeLangChainModel();
    },
  });

  assert.equal(provider.id, "fake-langchain");
  assert.deepEqual(provider.metadata, {
    id: "fake-langchain",
    displayName: "Fake LangChain",
    backing: "langchain",
    authModes: ["api-key"],
    supportsModelDiscovery: false,
    supportsConnectionTest: true,
  });

  const metadata = getProviderMetadata(provider);
  assert.equal(metadata.backing, "langchain");
  assert.deepEqual(metadata.authModes, ["api-key"]);

  const model = await provider.createModel({
    provider: "fake-langchain",
    model: "fake-model",
  });

  assert.equal(model.id, "fake-model");
  assert.equal(model.provider, "fake-langchain");
  assert.equal(model.capabilities.textGeneration, true);
  assert.equal(model.capabilities.streaming, true);
  assert.equal(model.capabilities.toolCalling, true);
  assert.equal(model.toolCallingMode, "native");
});

test("LangChain provider generate maps Dockline input to LangChain invoke", async () => {
  const calls = [];
  const provider = createLangChainChatProvider({
    id: "fake-langchain-generate",
    capabilities: { vision: true },
    createChatModel() {
      return fakeLangChainModel({
        async invoke(messages, options) {
          calls.push({ messages, options });
          return {
            content: "Hello from LangChain",
            response_metadata: { finish_reason: "stop" },
            usage_metadata: {
              input_tokens: 3,
              output_tokens: 4,
              total_tokens: 7,
            },
            tool_calls: [
              { id: "call_1", name: "lookup", args: { id: 123 } },
            ],
          };
        },
      });
    },
  });

  const model = await provider.createModel({
    provider: "fake-langchain-generate",
    model: "fake-model",
  });

  const result = await model.generate({
    messages: [
      { role: "system", content: "Be brief" },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this" },
          { type: "image", image: "https://example.test/image.png" },
        ],
      },
    ],
    tools: [
      {
        name: "lookup",
        description: "Lookup an item",
        inputSchema: {
          type: "object",
          properties: { id: { type: "number" } },
        },
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 50,
    stopSequences: ["END"],
    providerOptions: { topP: 0.9 },
  });

  assert.equal(model.capabilities.vision, true);
  assert.deepEqual(calls[0].messages, [
    { role: "system", type: "system", content: "Be brief" },
    {
      role: "human",
      type: "human",
      content: [
        { type: "text", text: "Describe this" },
        {
          type: "image_url",
          image_url: { url: "https://example.test/image.png" },
        },
      ],
    },
  ]);
  assert.equal(calls[0].options.temperature, 0.2);
  assert.equal(calls[0].options.maxTokens, 50);
  assert.equal(calls[0].options.maxOutputTokens, 50);
  assert.deepEqual(calls[0].options.stop, ["END"]);
  assert.equal(calls[0].options.topP, 0.9);
  assert.deepEqual(calls[0].options.tools, [
    {
      name: "lookup",
      description: "Lookup an item",
      schema: {
        type: "object",
        properties: { id: { type: "number" } },
      },
      inputSchema: {
        type: "object",
        properties: { id: { type: "number" } },
      },
    },
  ]);
  assert.deepEqual(result, {
    text: "Hello from LangChain",
    finishReason: "stop",
    usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    toolCalls: [{ id: "call_1", name: "lookup", arguments: { id: 123 } }],
    raw: result.raw,
  });
});

test("LangChain provider maps assistant and tool messages into invoke", async () => {
  const calls = [];
  const provider = createLangChainChatProvider({
    id: "fake-langchain-messages",
    createChatModel() {
      return fakeLangChainModel({
        async invoke(messages) {
          calls.push(messages);
          return { content: "ok" };
        },
      });
    },
  });

  const model = await provider.createModel({
    provider: "fake-langchain-messages",
    model: "fake-model",
  });

  await model.generate({
    messages: [
      {
        role: "assistant",
        content: "Calling a tool",
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "dockline" } }],
      },
      { role: "tool", toolCallId: "call_1", content: "result" },
    ],
  });

  assert.deepEqual(calls[0], [
    {
      role: "assistant",
      type: "ai",
      content: "Calling a tool",
      tool_calls: [{ id: "call_1", name: "search", args: { q: "dockline" } }],
      additional_kwargs: {
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "search",
              arguments: "{\"q\":\"dockline\"}",
            },
          },
        ],
      },
    },
    {
      role: "tool",
      type: "tool",
      tool_call_id: "call_1",
      content: "result",
    },
  ]);
});

test("LangChain provider stream maps chunks to Dockline events", async () => {
  const provider = createLangChainChatProvider({
    id: "fake-langchain-stream",
    createChatModel() {
      return fakeLangChainModel({
        async *stream(messages, options) {
          assert.equal(messages[0].content, "Hello");
          assert.equal(options.maxTokens, 12);

          yield { content: "Hel" };
          yield { content: "lo" };
          yield {
            content: "",
            tool_call_chunks: [
              { id: "call_1", name: "lookup", args: "{\"id\":" },
            ],
          };
          yield {
            content: "",
            tool_call_chunks: [
              { id: "call_1", args: "123}" },
            ],
            usage_metadata: {
              input_tokens: 2,
              output_tokens: 3,
              total_tokens: 5,
            },
          };
        },
      });
    },
  });

  const model = await provider.createModel({
    provider: "fake-langchain-stream",
    model: "fake-model",
  });

  const events = [];

  for await (const event of model.stream({
    messages: [{ role: "user", content: "Hello" }],
    maxOutputTokens: 12,
  })) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "text-delta", text: "Hel" },
    { type: "text-delta", text: "lo" },
    { type: "usage", usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } },
    { type: "tool-call", toolCall: { id: "call_1", name: "lookup", arguments: { id: 123 } } },
    { type: "done" },
  ]);
});

test("LangChain provider can register with the global provider registry", async () => {
  globalProviderRegistry.clear();

  registerLangChainChatProvider({
    id: "registered-langchain",
    createChatModel: () => fakeLangChainModel(),
  });

  const model = await createModel({
    provider: "registered-langchain",
    model: "fake-model",
  });

  const result = await model.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(result.text, "ok");
});

function fakeLangChainModel(overrides = {}) {
  return {
    async invoke() {
      return { content: "ok" };
    },
    async *stream() {
      yield { content: "ok" };
    },
    ...overrides,
  };
}
