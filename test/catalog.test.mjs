import assert from "node:assert/strict";
import test from "node:test";

import {
  getCatalogProvider,
  listCatalogProviderIds,
  listCatalogProviders,
  providerCatalog,
  requireCatalogProvider,
} from "../packages/catalog/dist/index.js";

test("@dockline/catalog exposes a deduplicated user-facing provider catalog", () => {
  const ids = providerCatalog.map((provider) => provider.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(providerCatalog.length, 89);

  assert.ok(ids.includes("openai"));
  assert.ok(ids.includes("openrouter"));
  assert.ok(ids.includes("vercel-ai-gateway"));
  assert.ok(ids.includes("github-copilot"));
  assert.ok(ids.includes("openai-chatgpt-account"));
});

test("@dockline/catalog keeps gateways as providers instead of directories", () => {
  assert.equal(getCatalogProvider("openrouter")?.providerKind, "gateway");
  assert.equal(getCatalogProvider("vercel-gateway")?.providerKind, "gateway");
  assert.equal(getCatalogProvider("openrouter")?.recommendedBacking, "gateway");
});

test("@dockline/catalog exposes origin and auth metadata", () => {
  const openai = requireCatalogProvider("openai");
  assert.deepEqual(
    openai.sources.map((source) => source.id),
    ["ai-sdk", "langchain"],
  );
  assert.deepEqual(openai.authModes, ["api-key"]);

  const chatgpt = requireCatalogProvider("chatgpt");
  assert.equal(chatgpt.id, "openai-chatgpt-account");
  assert.deepEqual(chatgpt.sources.map((source) => source.id), ["dockline-native"]);
  assert.deepEqual(chatgpt.authModes, ["oauth", "device-code"]);
});

test("@dockline/catalog filters by source, backing, auth, and provider kind", () => {
  assert.ok(listCatalogProviderIds({ source: "langchain" }).includes("yandex"));
  assert.ok(listCatalogProviderIds({ source: "dockline-native" }).includes("github-copilot"));
  assert.ok(listCatalogProviderIds({ backing: "vercel-ai-sdk" }).includes("openai"));
  assert.ok(listCatalogProviderIds({ authMode: "device-code" }).includes("github-copilot"));
  assert.ok(listCatalogProviders({ providerKind: "gateway" }).some((provider) => provider.id === "vercel-ai-gateway"));
});

test("@dockline/catalog clones entries on read", () => {
  const first = requireCatalogProvider("openai");
  first.authModes.push("custom");

  assert.deepEqual(requireCatalogProvider("openai").authModes, ["api-key"]);
});
