import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  FileSystemTokenStore,
  MemoryTokenStore,
  ProviderRegistry,
  assertCapabilities,
  assertModelRequirements,
  chatModelCapabilities,
  createModel,
  getMissingCapabilities,
  hasCapability,
  getProviderMetadata,
  listAvailableProviders,
  listProviderMetadata,
  listProviderModels,
  testProviderConnection,
  validateBaseModelConfig,
  validateProviderDiscoveryConfig,
} from "../packages/core/dist/index.js";
import {
  capabilitiesFromProfile,
  mergeCapabilityProfile,
} from "../packages/core/dist/capabilities.js";
import {
  createAuthTokenStoreKey,
  deleteAuthToken as deleteExperimentalAuthToken,
  getAuthToken,
  setAuthToken,
} from "../packages/core/dist/experimental.js";

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

test("capability profiles merge known values with runtime overrides", () => {
  const known = {
    provider: "openai-compatible",
    model: "demo",
    capabilities: {
      textGeneration: true,
      streaming: true,
      vision: true,
      toolCalling: true,
    },
    toolCallingMode: "native",
    notes: ["known profile"],
  };

  const profile = mergeCapabilityProfile(known, {
    capabilities: {
      vision: false,
      structuredOutput: true,
    },
    structuredOutputMode: "json-schema",
    notes: ["runtime override"],
  });

  assert.deepEqual(profile.capabilities, {
    textGeneration: true,
    streaming: true,
    vision: false,
    toolCalling: true,
    structuredOutput: true,
  });
  assert.equal(profile.toolCallingMode, "native");
  assert.equal(profile.structuredOutputMode, "json-schema");
  assert.deepEqual(profile.notes, ["runtime override"]);
});

test("capabilitiesFromProfile returns a complete capability map", () => {
  const capabilities = capabilitiesFromProfile({
    capabilities: {
      textGeneration: true,
      streaming: true,
      files: true,
    },
  });

  assert.equal(capabilities.textGeneration, true);
  assert.equal(capabilities.streaming, true);
  assert.equal(capabilities.files, true);
  assert.equal(capabilities.toolCalling, false);
  assert.equal(capabilities.localExecution, false);
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
  assert.throws(
    () => registry.set({ id: "broken", async createModel() {}, testConnection: true }),
    /testConnection must be a function/,
  );
  assert.throws(
    () => registry.set({ id: "broken", async createModel() {}, listModels: true }),
    /listModels must be a function/,
  );
  assert.throws(
    () => registry.set({ id: "broken", metadata: true, async createModel() {} }),
    /metadata must be an object/,
  );
});

test("provider metadata falls back for providers without metadata", () => {
  const registry = new ProviderRegistry();

  registry.register({
    id: "test",
    displayName: "Test Provider",
    async createModel() {
      return createTestModel();
    },
    async listModels() {
      return [];
    },
  });

  assert.deepEqual(listProviderMetadata(registry), [
    {
      id: "test",
      displayName: "Test Provider",
      authModes: [],
      supportsModelDiscovery: true,
      supportsConnectionTest: false,
      runtimeOptions: undefined,
    },
  ]);
  assert.deepEqual(listAvailableProviders(registry), listProviderMetadata(registry));
});

test("provider metadata uses provider metadata when available", () => {
  const provider = {
    id: "test",
    displayName: "Fallback Name",
    metadata: {
      displayName: "Picker Name",
      description: "Shown in provider picker.",
      backing: "openai-compatible",
      authModes: ["api-key"],
      supportsModelDiscovery: false,
      supportsConnectionTest: true,
      runtimeOptions: [
        {
          id: "reasoning.effort",
          type: "enum",
          category: "reasoning",
          enumValues: [{ value: "low" }, { value: "high", displayName: "High" }],
        },
      ],
    },
    async createModel() {
      return createTestModel();
    },
    async listModels() {
      return [];
    },
  };

  const metadata = getProviderMetadata(provider);

  assert.deepEqual(metadata, {
    id: "test",
    displayName: "Picker Name",
    description: "Shown in provider picker.",
    backing: "openai-compatible",
    authModes: ["api-key"],
    supportsModelDiscovery: false,
    supportsConnectionTest: true,
    runtimeOptions: [
      {
        id: "reasoning.effort",
        type: "enum",
        category: "reasoning",
        enumValues: [{ value: "low" }, { value: "high", displayName: "High" }],
      },
    ],
  });

  metadata.authModes.push("oauth");
  metadata.runtimeOptions[0].enumValues[0].displayName = "Low";

  assert.deepEqual(provider.metadata.authModes, ["api-key"]);
  assert.deepEqual(provider.metadata.runtimeOptions[0].enumValues[0], { value: "low" });
});

test("validateProviderDiscoveryConfig allows model-less discovery config", () => {
  assert.doesNotThrow(() =>
    validateProviderDiscoveryConfig({
      provider: "test",
      apiKey: "key",
      headers: { Authorization: "Bearer key" },
    }),
  );

  assert.throws(
    () => validateProviderDiscoveryConfig({ provider: "test", model: " " }),
    /"model" must be a non-empty string/,
  );
});

test("testProviderConnection returns unsupported for providers without a hook", async () => {
  const registry = new ProviderRegistry();

  registry.register({
    id: "test",
    async createModel() {
      return createTestModel();
    },
  });

  const result = await testProviderConnection(
    { provider: "test", model: "demo" },
    undefined,
    registry,
  );

  assert.deepEqual(result, {
    ok: false,
    status: "unsupported",
    provider: "test",
    model: "demo",
    message: 'Provider "test" does not implement testConnection.',
    retryable: false,
  });
});

test("testProviderConnection and listProviderModels delegate to provider discovery hooks", async () => {
  const registry = new ProviderRegistry();
  const calls = [];

  registry.register({
    id: "test",
    async createModel() {
      return createTestModel();
    },
    async testConnection(config, context) {
      calls.push(["testConnection", config, context]);
      return { ok: true, status: "ok", provider: config.provider };
    },
    async listModels(config, context) {
      calls.push(["listModels", config, context]);
      return [{ id: "alpha" }, { id: "beta", provider: "custom" }];
    },
  });

  const context = {};
  const connection = await testProviderConnection(
    { provider: "test", model: "demo", apiKey: "key" },
    context,
    registry,
  );
  const models = await listProviderModels({ provider: "test", apiKey: "key" }, context, registry);

  assert.equal(connection.ok, true);
  assert.equal(connection.status, "ok");
  assert.equal(connection.model, "demo");
  assert.deepEqual(models, [
    { id: "alpha", provider: "test" },
    { id: "beta", provider: "custom" },
  ]);
  assert.equal(calls[0][0], "testConnection");
  assert.equal(calls[0][1].model, "demo");
  assert.equal(calls[0][2], context);
  assert.equal(calls[1][0], "listModels");
  assert.equal(calls[1][1].model, undefined);
  assert.equal(calls[1][2], context);
});

test("listProviderModels rejects providers without a hook", async () => {
  const registry = new ProviderRegistry();

  registry.register({
    id: "test",
    async createModel() {
      return createTestModel();
    },
  });

  await assert.rejects(
    () => listProviderModels({ provider: "test" }, undefined, registry),
    /does not implement listModels/,
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

test("auth token helpers derive stable non-secret TokenStore keys", () => {
  const key = createAuthTokenStoreKey({
    provider: "github",
    authMode: "device-code",
    subject: "alice@example.com",
    scopes: ["repo", "codespace", "repo"],
  });

  assert.equal(
    key,
    "auth:provider=github&auth=device-code&subject=alice%40example.com&scope=codespace&scope=repo",
  );
  assert.equal(key.includes("access-token"), false);

  assert.throws(
    () =>
      createAuthTokenStoreKey({
        provider: "github",
        authMode: "device-code",
        scopes: ["repo", ""],
      }),
    /scopes must be non-empty strings/,
  );
});

test("auth token helpers require explicit TokenStore writes and clone records", async () => {
  let stored = null;
  const store = {
    async get() {
      return stored;
    },
    async set(_key, value) {
      stored = value;
    },
    async delete() {
      stored = null;
    },
  };
  const key = { provider: "github", authMode: "device-code", subject: "alice" };
  const token = {
    accessToken: "access",
    refreshToken: "refresh",
    scopes: ["repo"],
    metadata: { provider: "github" },
  };

  assert.equal(await getAuthToken(store, key), null);

  await setAuthToken(store, key, token);
  token.scopes.push("mutated");
  token.metadata.provider = "mutated";

  const read = await getAuthToken(store, key);
  assert.deepEqual(read, {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: undefined,
    scopes: ["repo"],
    metadata: { provider: "github" },
  });

  read.scopes.push("read-mutation");
  assert.deepEqual((await getAuthToken(store, key)).scopes, ["repo"]);

  await deleteExperimentalAuthToken(store, key);
  assert.equal(await getAuthToken(store, key), null);
});

test("FileSystemTokenStore persists token records without exposing keys as paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dockline-token-store-"));
  const store = new FileSystemTokenStore({ directory });
  const key = "../provider/account";
  const token = {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: Date.now() + 60_000,
    scopes: ["email"],
    metadata: { provider: "test" },
  };

  try {
    await store.set(key, token);
    token.scopes.push("mutated");
    token.metadata.provider = "mutated";

    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.equal(files[0].endsWith(".json"), true);
    assert.equal(files[0].includes(".."), false);
    assert.equal(files[0].includes("/"), false);

    const reloadedStore = new FileSystemTokenStore({ directory });
    const stored = await reloadedStore.get(key);
    assert.deepEqual(stored, {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: token.expiresAt,
      scopes: ["email"],
      metadata: { provider: "test" },
    });

    stored.scopes.push("read-mutation");
    assert.deepEqual((await reloadedStore.get(key)).scopes, ["email"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FileSystemTokenStore overwrites atomically and deletes idempotently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dockline-token-store-"));
  const store = new FileSystemTokenStore({ directory });

  try {
    await store.set("test", { accessToken: "first" });
    await store.set("test", { accessToken: "second", scopes: ["profile"] });

    assert.deepEqual(await store.get("test"), {
      accessToken: "second",
      scopes: ["profile"],
      refreshToken: undefined,
      expiresAt: undefined,
      metadata: undefined,
    });

    const files = await readdir(directory);
    assert.deepEqual(files.filter((file) => file.endsWith(".tmp")), []);

    await store.delete("test");
    await store.delete("test");
    assert.equal(await store.get("test"), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FileSystemTokenStore rejects malformed stored records without including secrets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dockline-token-store-"));
  const store = new FileSystemTokenStore({ directory });

  try {
    await store.set("test", { accessToken: "secret-access-token" });
    const [file] = await readdir(directory);
    await writeFile(join(directory, file), "{\"accessToken\":42,\"refreshToken\":\"secret-refresh-token\"}\n");

    await assert.rejects(
      () => store.get("test"),
      (error) =>
        error instanceof Error &&
        /malformed/.test(error.message) &&
        !error.message.includes("secret-access-token") &&
        !error.message.includes("secret-refresh-token"),
    );

    const raw = await readFile(join(directory, file), "utf8");
    assert.equal(raw.includes("secret-refresh-token"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
