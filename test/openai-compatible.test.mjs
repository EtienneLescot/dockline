import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  createModel,
  getProviderMetadata,
  listProviderModels,
  testProviderConnection,
} from "../packages/core/dist/index.js";
import {
  createOpenAICompatibleProvider,
  registerOpenAICompatibleProvider,
} from "../packages/openai-compatible/dist/index.js";

test("OpenAI-compatible provider exposes concrete metadata", () => {
  const provider = createOpenAICompatibleProvider({
    id: "local-openai",
    displayName: "Local OpenAI-compatible",
  });

  assert.deepEqual(provider.metadata, {
    id: "local-openai",
    displayName: "Local OpenAI-compatible",
    backing: "openai-compatible",
    authModes: ["api-key", "custom"],
    supportsModelDiscovery: true,
    supportsConnectionTest: true,
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
  assert.equal(metadata.id, "local-openai");
  assert.equal(metadata.displayName, "Local OpenAI-compatible");
  assert.equal(metadata.backing, "openai-compatible");
  assert.deepEqual(metadata.authModes, ["api-key", "custom"]);
  assert.equal(metadata.supportsModelDiscovery, true);
  assert.equal(metadata.supportsConnectionTest, true);
  assert.deepEqual(
    metadata.runtimeOptions.map((option) => option.id),
    ["temperature", "maxOutputTokens"],
  );
  assert.notEqual(metadata.runtimeOptions, provider.metadata.runtimeOptions);
});

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

test("OpenAI-compatible stream parses multiline CRLF SSE events", async () => {
  const server = await createServer(async (_req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    });

    res.write("data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\r\n\r\n");
    res.write("data: {\"choices\":[{\"delta\":{\"content\":\r\n");
    res.write("data: \"lo\"}}]}\r\n\r\n");
    res.write("data: [DONE]\r\n\r\n");
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

test("OpenAI-compatible stream keeps separate sparse tool call deltas in index order", async () => {
  const server = await createServer(async (_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 1,
                  id: "call_2",
                  function: { name: "lookup", arguments: "{\"id\":\"42\"}" },
                },
                {
                  index: 0,
                  function: { name: "search", arguments: "not-json" },
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
                  id: "call_1",
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
          inputSchema: { type: "object" },
        },
        {
          name: "lookup",
          inputSchema: { type: "object" },
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
          arguments: "not-json",
        },
      },
      {
        type: "tool-call",
        toolCall: {
          id: "call_2",
          name: "lookup",
          arguments: { id: "42" },
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

test("OpenAI-compatible maps nonstandard provider error bodies", async () => {
  const cases = [
    {
      status: 400,
      body: { error: "context window exceeded" },
      expectedCode: "CONTEXT_LENGTH_EXCEEDED",
      expectedMessage: "context window exceeded",
      retryable: false,
    },
    {
      status: 503,
      body: { error: { code: "overloaded" } },
      expectedCode: "PROVIDER_UNAVAILABLE",
      expectedMessage: "overloaded",
      retryable: true,
    },
    {
      status: 404,
      body: "",
      expectedCode: "MODEL_NOT_FOUND",
      expectedMessage: "Not Found",
      retryable: false,
    },
  ];

  for (const providerError of cases) {
    const server = await createServer(async (_req, res) => {
      const contentType = typeof providerError.body === "string" ? "text/plain" : "application/json";
      res.writeHead(providerError.status, { "content-type": contentType });
      res.end(typeof providerError.body === "string" ? providerError.body : JSON.stringify(providerError.body));
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
          assert.equal(error.code, providerError.expectedCode);
          assert.equal(error.message, providerError.expectedMessage);
          assert.equal(error.statusCode, providerError.status);
          assert.equal(error.retryable, providerError.retryable);
          return true;
        },
      );
    } finally {
      await server.close();
    }
  }
});

test("OpenAI-compatible generate normalizes request network failures", async () => {
  const server = await createServer(async (_req, res) => {
    res.destroy();
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
        assert.equal(error.code, "PROVIDER_UNAVAILABLE");
        assert.equal(error.provider, "openai-compatible");
        assert.equal(error.model, "test-model");
        assert.equal(error.retryable, true);
        assert(error.originalError);
        return true;
      },
    );
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible stream yields request errors as events", async () => {
  const server = await createServer(async (_req, res) => {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Temporarily unavailable" } }));
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

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "error");
    assert.equal(events[0].error.code, "PROVIDER_UNAVAILABLE");
    assert.equal(events[0].error.message, "Temporarily unavailable");
    assert.equal(events[0].error.retryable, true);
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible request payload omits empty optional fields", async () => {
  const server = await createServer(async (req, res) => {
    const body = JSON.parse(await readBody(req));

    assert.equal(body.model, "test-model");
    assert.equal(body.stream, false);
    assert(!Object.hasOwn(body, "tools"));
    assert(!Object.hasOwn(body, "stop"));
    assert(!Object.hasOwn(body, "temperature"));
    assert(!Object.hasOwn(body, "response_format"));
    assert.equal(body.extra_body, "kept");

    sendJson(res, {
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    });
  });

  try {
    registerOpenAICompatibleProvider();

    const model = await createModel({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
    });

    const result = await model.generate({
      messages: [{ role: "user", content: "Hello" }],
      tools: [],
      stopSequences: [],
      providerOptions: { extra_body: "kept" },
    });

    assert.equal(result.text, "ok");
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible listModels fetches standard OpenAI-compatible model descriptors", async () => {
  const server = await createServer(async (req, res) => {
    assert.equal(req.method, "GET");
    assert.equal(req.url, "/v1/models");
    assert.equal(req.headers.authorization, "Bearer test-key");
    assert.equal(req.headers["x-custom"], "custom");

    sendJson(res, {
      object: "list",
      data: [
        { id: "alpha", object: "model" },
        { id: "beta", object: "model", name: "Beta Model" },
        { object: "model" },
        null,
      ],
    });
  });

  try {
    registerOpenAICompatibleProvider();

    const models = await listProviderModels({
      provider: "openai-compatible",
      baseURL: server.url,
      apiKey: "test-key",
      headers: { "X-Custom": "custom" },
    });

    assert.deepEqual(models, [
      { id: "alpha", provider: "openai-compatible", displayName: undefined },
      { id: "beta", provider: "openai-compatible", displayName: "Beta Model" },
    ]);
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible testConnection validates a configured model when models are listed", async () => {
  const server = await createServer(async (req, res) => {
    assert.equal(req.method, "GET");
    assert.equal(req.url, "/v1/models");
    sendJson(res, { data: [{ id: "alpha" }, { id: "beta" }] });
  });

  try {
    registerOpenAICompatibleProvider();

    const result = await testProviderConnection({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "beta",
    });

    assert.deepEqual(result, {
      ok: true,
      status: "ok",
      provider: "openai-compatible",
      model: "beta",
      retryable: false,
      details: { modelCount: 2 },
    });
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible testConnection reports configured model misses as misconfigured", async () => {
  const server = await createServer(async (_req, res) => {
    sendJson(res, { data: [{ id: "alpha" }] });
  });

  try {
    registerOpenAICompatibleProvider();

    const result = await testProviderConnection({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "missing",
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, "misconfigured");
    assert.equal(result.provider, "openai-compatible");
    assert.equal(result.model, "missing");
    assert.equal(result.retryable, false);
    assert.match(result.message, /not found/);
  } finally {
    await server.close();
  }
});

test("OpenAI-compatible testConnection normalizes unauthorized and unavailable responses", async () => {
  const cases = [
    {
      status: 401,
      body: { error: { message: "bad key" } },
      expectedStatus: "unauthorized",
      retryable: false,
    },
    {
      status: 429,
      body: { error: { message: "slow down" } },
      expectedStatus: "unavailable",
      retryable: true,
    },
  ];

  for (const testCase of cases) {
    const server = await createServer(async (_req, res) => {
      res.writeHead(testCase.status, { "content-type": "application/json" });
      res.end(JSON.stringify(testCase.body));
    });

    try {
      registerOpenAICompatibleProvider();

      const result = await testProviderConnection({
        provider: "openai-compatible",
        baseURL: server.url,
        model: "test-model",
      });

      assert.equal(result.ok, false);
      assert.equal(result.status, testCase.expectedStatus);
      assert.equal(result.provider, "openai-compatible");
      assert.equal(result.model, "test-model");
      assert.equal(result.message, testCase.body.error.message);
      assert.equal(result.retryable, testCase.retryable);
      assert.deepEqual(result.details, { statusCode: testCase.status });
    } finally {
      await server.close();
    }
  }
});

test("OpenAI-compatible testConnection reports missing or malformed model discovery as misconfigured", async () => {
  registerOpenAICompatibleProvider();

  const missingBaseURL = await testProviderConnection({
    provider: "openai-compatible",
    model: "test-model",
  });

  assert.equal(missingBaseURL.ok, false);
  assert.equal(missingBaseURL.status, "misconfigured");
  assert.equal(missingBaseURL.retryable, false);

  const server = await createServer(async (_req, res) => {
    sendJson(res, { object: "list" });
  });

  try {
    const malformed = await testProviderConnection({
      provider: "openai-compatible",
      baseURL: server.url,
      model: "test-model",
    });

    assert.equal(malformed.ok, false);
    assert.equal(malformed.status, "misconfigured");
    assert.equal(malformed.retryable, false);
    assert.match(malformed.message, /data array/);
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
