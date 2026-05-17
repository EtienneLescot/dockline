import assert from "node:assert/strict";
import test from "node:test";
import { toLangChainChatModel } from "../packages/langchain/dist/index.js";

test("LangChain adapter invokes a Dockline model with normalized messages", async () => {
  const calls = [];
  const adapter = toLangChainChatModel(fakeDocklineModel({
    async generate(input) {
      calls.push(input);
      return {
        text: `reply:${input.messages[0].content}`,
        usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
        finishReason: "stop",
      };
    },
  }));

  const result = await adapter.invoke("hello", {
    temperature: 0.2,
    maxTokens: 20,
    stop: ["END"],
  });

  assert.equal(result._getType(), "ai");
  assert.equal(result.content, "reply:hello");
  assert.deepEqual(result.usage_metadata, {
    input_tokens: 4,
    output_tokens: 2,
    total_tokens: 6,
  });
  assert.equal(calls[0].messages[0].role, "user");
  assert.equal(calls[0].temperature, 0.2);
  assert.equal(calls[0].maxOutputTokens, 20);
  assert.deepEqual(calls[0].stopSequences, ["END"]);
});

test("LangChain adapter maps message arrays, bound tools, and tool calls", async () => {
  const calls = [];
  const adapter = toLangChainChatModel(fakeDocklineModel({
    async generate(input) {
      calls.push(input);
      return {
        text: "",
        toolCalls: [{ id: "call_1", name: "search", arguments: { query: "dockline" } }],
        finishReason: "tool-calls",
      };
    },
  })).bindTools([
    {
      name: "search",
      description: "Search",
      schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ]);

  const result = await adapter.invoke([
    { role: "system", content: "be brief" },
    { _getType: () => "human", content: [{ type: "text", text: "find docs" }] },
  ]);

  assert.deepEqual(calls[0].messages, [
    { role: "system", content: "be brief" },
    { role: "user", content: [{ type: "text", text: "find docs" }] },
  ]);
  assert.deepEqual(calls[0].tools, [
    {
      name: "search",
      description: "Search",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ]);
  assert.deepEqual(result.tool_calls, [
    { id: "call_1", name: "search", arguments: { query: "dockline" } },
  ]);
  assert.equal(result.additional_kwargs.tool_calls[0].function.arguments, "{\"query\":\"dockline\"}");
});

test("LangChain adapter streams Dockline text and tool-call events as chunks", async () => {
  const adapter = toLangChainChatModel(fakeDocklineModel({
    async *stream(input) {
      assert.equal(input.messages[0].content, "hello");
      yield { type: "text-delta", text: "Hel" };
      yield { type: "text-delta", text: "lo" };
      yield {
        type: "tool-call",
        toolCall: { id: "call_1", name: "lookup", arguments: { id: 123 } },
      };
      yield { type: "done" };
    },
  }));

  const chunks = [];

  for await (const chunk of adapter.stream("hello")) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks.map((chunk) => chunk.content), ["Hel", "lo", ""]);
  assert.deepEqual(chunks[2].tool_call_chunks, [
    { id: "call_1", name: "lookup", args: "{\"id\":123}", index: 0 },
  ]);
});

function fakeDocklineModel(overrides = {}) {
  return {
    id: "fake",
    provider: "test",
    capabilities: {
      textGeneration: true,
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      reasoning: false,
      vision: false,
      files: false,
      promptCaching: false,
      embeddings: false,
      imageGeneration: false,
      computerUse: false,
      localExecution: false,
      codingAgentRuntime: false,
    },
    async generate() {
      return { text: "ok" };
    },
    async *stream() {
      yield { type: "done" };
    },
    ...overrides,
  };
}
