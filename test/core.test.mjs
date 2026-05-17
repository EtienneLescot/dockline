import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryTokenStore,
  ProviderRegistry,
  assertCapabilities,
  assertModelRequirements,
  chatModelCapabilities,
  createModel,
  getMissingCapabilities,
  hasCapability,
  validateBaseModelConfig,
} from "../packages/core/dist/index.js";

const createTestModel = (overrides = {}) => ({
  id: "demo",
  provider: "test",
  capabilities: chatModelCapabilities(),
  async generate() {
    return { text: "ok" };
  },
  async *stream() {
    yield { type: "text-delta", text: "ok" };
    yield { type: "done" };
  },
  ...overrides,
});

test("createModel resolves a registered provider", async () => {
  const registry = new ProviderRegistry();

  registry.register({
    id: "test",
    async createModel(config) {
      return {
        id: config.model,
        provider: config.provider,
        capabilities: chatModelCapabilities(),
        async generate() {
          return { text: "ok" };
        },
        async *stream() {
          yield { type: "text-delta", text: "ok" };
          yield { type: "done" };
        },
      };
    },
  });

  const model = await createModel({ provider: "test", model: "demo" }, undefined, registry);

  assert.equal(model.id, "demo");
  assert.equal(model.provider, "test");
  assert.equal(model.capabilities.textGeneration, true);
});

test("createModel fails for unknown providers", async () => {
  await assert.rejects(
    () => createModel({ provider: "missing", model: "demo" }, undefined, new ProviderRegistry()),
    /Provider "missing" is not registered/,
  );
});

test("capability helpers report present and missing capabilities", () => {
  const capabilities = chatModelCapabilities({ toolCalling: true });

  assert.equal(hasCapability(capabilities, "textGeneration"), true);
  assert.equal(hasCapability(capabilities, "structuredOutput"), false);
  assert.deepEqual(getMissingCapabilities(capabilities, ["toolCalling", "structuredOutput"]), [
    "structuredOutput",
  ]);
});

test("assertCapabilities rejects missing capabilities", () => {
  assert.throws(
    () => assertCapabilities(createTestModel(), ["vision"]),
    /missing required capabilities: vision/,
  );
});

test("assertModelRequirements validates modes", () => {
  const model = createTestModel({
    toolCallingMode: "native",
    structuredOutputMode: "json-schema",
    capabilities: chatModelCapabilities({ toolCalling: true, structuredOutput: true }),
  });

  assert.doesNotThrow(() =>
    assertModelRequirements(model, {
      capabilities: ["toolCalling", "structuredOutput"],
      toolCallingMode: ["native", "emulated"],
      structuredOutputMode: "json-schema",
    }),
  );

  assert.throws(
    () => assertModelRequirements(model, { structuredOutputMode: "provider-native" }),
    /requires structured output mode provider-native, but has json-schema/,
  );
});

test("validateBaseModelConfig rejects blank and malformed fields", () => {
  assert.throws(
    () => validateBaseModelConfig({ provider: " ", model: "demo" }),
    /non-empty provider string/,
  );
  assert.throws(
    () => validateBaseModelConfig({ provider: "test", model: " " }),
    /non-empty model string/,
  );
  assert.throws(
    () => validateBaseModelConfig({ provider: "test", model: "demo", apiKey: 42 }),
    /"apiKey" must be a string/,
  );
  assert.throws(
    () => validateBaseModelConfig({ provider: "test", model: "demo", headers: { Authorization: 42 } }),
    /header "Authorization" must be a string/,
  );
});

test("ProviderRegistry validates providers before registration", () => {
  const registry = new ProviderRegistry();

  assert.throws(
    () => registry.register({ id: "", async createModel() {} }),
    /non-empty id string/,
  );
  assert.throws(
    () => registry.set({ id: "broken" }),
    /must include a createModel function/,
  );
});

test("MemoryTokenStore copies token records on read and write", async () => {
  const store = new MemoryTokenStore();
  const token = {
    accessToken: "access",
    refreshToken: "refresh",
    scopes: ["email"],
    metadata: { provider: "test" },
  };

  await store.set("test", token);
  token.scopes.push("mutated");
  token.metadata.provider = "mutated";

  const stored = await store.get("test");
  assert.deepEqual(stored.scopes, ["email"]);
  assert.deepEqual(stored.metadata, { provider: "test" });

  stored.scopes.push("read-mutation");
  const reread = await store.get("test");
  assert.deepEqual(reread.scopes, ["email"]);

  await store.delete("test");
  assert.equal(await store.get("test"), null);
});
