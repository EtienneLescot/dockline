import assert from "node:assert/strict";
import test from "node:test";

import { ProviderRegistry } from "../packages/core/dist/index.js";
import {
  allProviderFactories,
  allProviders,
  createAISDKChatProvider,
  listCatalogProviderIds,
  registerAllProviders,
} from "../packages/all/dist/index.js";

const expectedProviderIds = [
  "openrouter",
  "openai-compatible",
  "openai",
  "google",
  "anthropic",
  "mistral",
  "minimax",
  "deepseek",
  "moonshot",
  "alibaba",
  "copilot",
  "openai-oauth",
];

test("@dockline/all exposes the full implemented and planned provider set", () => {
  assert.deepEqual(Object.keys(allProviderFactories), [
    "openrouter",
    "openaiCompatible",
    "openai",
    "google",
    "anthropic",
    "mistral",
    "minimax",
    "deepseek",
    "moonshot",
    "alibaba",
    "copilot",
    "openaiOAuth",
  ]);

  const providers = allProviders();
  assert.deepEqual(
    providers.map((provider) => provider.id),
    expectedProviderIds,
  );
  assert.equal(
    providers.find((provider) => provider.id === "openai")?.metadata.supportsConnectionTest,
    false,
  );
  assert.equal(
    providers.find((provider) => provider.id === "anthropic")?.metadata.supportsConnectionTest,
    false,
  );
  assert.equal(
    providers.find((provider) => provider.id === "google")?.metadata.supportsConnectionTest,
    false,
  );
  assert.equal(
    providers.find((provider) => provider.id === "mistral")?.metadata.supportsConnectionTest,
    false,
  );
});

test("@dockline/all registers providers into a supplied registry", () => {
  const registry = new ProviderRegistry();

  assert.equal(registerAllProviders(registry), registry);
  assert.deepEqual(
    registry.list().map((provider) => provider.id),
    expectedProviderIds,
  );

  assert.doesNotThrow(() => registerAllProviders(registry));
});

test("@dockline/all re-exports the AI SDK bridge without registering it as a concrete provider", () => {
  assert.equal(typeof createAISDKChatProvider, "function");
  assert.equal("aiSDK" in allProviderFactories, false);
});

test("@dockline/all re-exports the provider catalog", () => {
  assert.ok(listCatalogProviderIds().includes("openai-chatgpt-account"));
});
