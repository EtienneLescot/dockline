import assert from "node:assert/strict";
import test from "node:test";

import { ProviderRegistry } from "../packages/core/dist/index.js";
import {
  createConnectorResolver,
  listResolvableCatalogProviders,
  resolveConnector,
} from "../packages/resolver/dist/index.js";

test("@dockline/resolver resolves an available connector candidate", () => {
  const provider = fakeProvider("openrouter");
  const result = resolveConnector({
    provider: "openrouter",
    authMode: "api-key",
  }, {
    candidates: [{
      catalogProviderId: "openrouter",
      backing: "gateway",
      authModes: ["api-key"],
      createProvider: () => provider,
    }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, provider);
  assert.equal(result.catalogProvider.id, "openrouter");
  assert.equal(result.backing, "gateway");
});

test("@dockline/resolver reports unknown and unsupported auth providers clearly", () => {
  assert.deepEqual(
    resolveConnector({ provider: "not-real" }),
    {
      ok: false,
      status: "unknown-provider",
      provider: "not-real",
      message: "Unknown Dockline catalog provider \"not-real\".",
    },
  );

  const authResult = resolveConnector({
    provider: "openrouter",
    authMode: "oauth",
  });

  assert.equal(authResult.ok, false);
  assert.equal(authResult.status, "unsupported-auth-mode");
  assert.equal(authResult.provider, "openrouter");
});

test("@dockline/resolver reports planned native catalog entries", () => {
  const result = resolveConnector({ provider: "github-copilot", authMode: "device-code" });

  assert.equal(result.ok, false);
  assert.equal(result.status, "planned-native");
  assert.equal(result.provider, "github-copilot");
});

test("@dockline/resolver reports missing packages when installedPackages is supplied", () => {
  const result = resolveConnector({
    provider: "openai",
    authMode: "api-key",
    installedPackages: ["@dockline/core"],
  }, {
    candidates: [{
      catalogProviderId: "openai",
      backing: "vercel-ai-sdk",
      authModes: ["api-key"],
      requiredPackages: ["@ai-sdk/openai"],
      createProvider: () => fakeProvider("openai"),
    }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing-package");
  assert.deepEqual(result.requiredPackages, ["@ai-sdk/openai"]);
});

test("@dockline/resolver can register a resolved provider", () => {
  const registry = new ProviderRegistry();
  const resolver = createConnectorResolver({
    candidates: [{
      catalogProviderId: "openrouter",
      backing: "gateway",
      createProvider: () => fakeProvider("openrouter"),
    }],
  });

  const result = resolver.register({ provider: "openrouter" }, registry);

  assert.equal(result.ok, true);
  assert.equal(registry.get("openrouter"), result.provider);
});

test("@dockline/resolver lists resolvable catalog providers", () => {
  const providers = listResolvableCatalogProviders({
    candidates: [{
      catalogProviderId: "openrouter",
      backing: "gateway",
      createProvider: () => fakeProvider("openrouter"),
    }],
  });

  assert.deepEqual(providers.map((provider) => provider.id), ["openrouter"]);
});

const fakeProvider = (id) => ({
  id,
  displayName: id,
  metadata: {
    id,
    displayName: id,
    authModes: ["api-key"],
    supportsModelDiscovery: false,
    supportsConnectionTest: false,
  },
  async createModel() {
    throw new Error("not used");
  },
});
