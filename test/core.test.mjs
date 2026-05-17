import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderRegistry,
  chatModelCapabilities,
  createModel,
} from "../packages/core/dist/index.js";

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
