import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createModel } from "../packages/core/dist/index.js";
import { registerOpenAICompatibleProvider } from "../packages/openai-compatible/dist/index.js";

test("OpenAI-compatible generate normalizes text and usage", async () => {
  const server = await createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");

    const body = JSON.parse(await readBody(req));
    assert.equal(body.model, "test-model");
    assert.equal(body.stream, false);
    assert.equal(body.messages[0].content, "Hello");

    sendJson(res, {
      choices: [
        {
          message: { content: "Hi there" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 2,
        completion_tokens: 3,
        total_tokens: 5,
      },
    });
  });

  try {
    registerOpenAICompatibleProvider();

    const model = await createModel({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
      apiKey: "test-key",
    });

    const result = await model.generate({
      messages: [{ role: "user", content: "Hello" }],
    });

    assert.equal(result.text, "Hi there");
    assert.equal(result.finishReason, "stop");
    assert.deepEqual(result.usage, {
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible stream converts SSE text deltas into Dockline events", async () => {
  const server = await createServer(async (req, res) => {
    const body = JSON.parse(await readBody(req));
    assert.equal(body.stream, true);

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    });

    res.write(sse({ choices: [{ delta: { content: "Hel" } }] }));
    res.write(sse({ choices: [{ delta: { content: "lo" } }] }));
    res.write("data: [DONE]\n\n");
    res.end();
  });

  try {
    registerOpenAICompatibleProvider();

    const model = await createModel({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
    });

    const events = [];

    for await (const event of model.stream({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      events.push(event);
    }

    assert.deepEqual(events, [
      { type: "text-delta", text: "Hel" },
      { type: "text-delta", text: "lo" },
      { type: "done" },
    ]);
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible stream accumulates streamed tool call arguments", async () => {
  const server = await createServer(async (_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: { name: "search", arguments: "{\"query\":" },
                },
              ],
            },
          },
        ],
      }),
    );
    res.write(
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: "\"dockline\"}" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    );
    res.write("data: [DONE]\n\n");
    res.end();
  });

  try {
    registerOpenAICompatibleProvider();

    const model = await createModel({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
    });

    const events = [];

    for await (const event of model.stream({
      messages: [{ role: "user", content: "Search" }],
      tools: [
        {
          name: "search",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
        },
      ],
    })) {
      events.push(event);
    }

    assert.deepEqual(events, [
      {
        type: "tool-call",
        toolCall: {
          id: "call_1",
          name: "search",
          arguments: { query: "dockline" },
        },
      },
      { type: "done" },
    ]);
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible HTTP errors become Dockline errors", async () => {
  const server = await createServer(async (_req, res) => {
    res.writeHead(429, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Too many requests" } }));
  });

  try {
    registerOpenAICompatibleProvider();

    const model = await createModel({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
    });

    await assert.rejects(
      () => model.generate({ messages: [{ role: "user", content: "Hello" }] }),
      (error) => {
        assert.equal(error.code, "RATE_LIMITED");
        assert.equal(error.statusCode, 429);
        assert.equal(error.retryable, true);
        return true;
      },
    );
  } finally {
    await server.close();
  }
});

async function createServer(handler) {
  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(error.stack ?? error.message);
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  assert(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function sendJson(res, body) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function sse(body) {
  return `data: ${JSON.stringify(body)}\n\n`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
