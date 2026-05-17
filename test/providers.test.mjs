import assert from "node:assert/strict";
import test from "node:test";

import {
  anthropic,
  copilot,
  openai,
  openaiCompatible,
  openaiOAuth,
  openrouter,
} from "../packages/providers/dist/index.js";

test("@dockline/providers exports implemented provider factories", () => {
  const router = openrouter();
  assert.equal(router.id, "openrouter");
  assert.equal(router.displayName, "OpenRouter");
  assert.deepEqual(router.metadata.authModes, ["api-key"]);
  assert.equal(router.metadata.supportsModelDiscovery, true);
  assert.equal(typeof router.createModel, "function");

  const compatible = openaiCompatible({
    id: "local-openai",
    displayName: "Local OpenAI-compatible",
    baseURL: "http://localhost:1234/v1",
  });
  assert.equal(compatible.id, "local-openai");
  assert.equal(compatible.displayName, "Local OpenAI-compatible");
  assert.equal(compatible.metadata.backing, "openai-compatible");
});

test("@dockline/providers exports planned provider placeholders", async () => {
  const provider = anthropic();
  assert.equal(provider.id, "anthropic");
  assert.equal(provider.displayName, "Anthropic");
  assert.equal(provider.metadata.backing, "langchain");
  assert.deepEqual(provider.metadata.authModes, ["api-key"]);

  await assert.rejects(
    provider.createModel({ provider: "anthropic", model: "claude-placeholder" }),
    /Anthropic provider is planned but not implemented yet/,
  );

  assert.deepEqual(
    await provider.testConnection?.({ provider: "anthropic", model: "claude-placeholder" }),
    {
      ok: false,
      status: "unsupported",
      provider: "anthropic",
      model: "claude-placeholder",
      message: "Anthropic provider is planned but not implemented yet.",
      retryable: false,
    },
  );
});

test("@dockline/providers exports planned openai variants separately", () => {
  assert.equal(openai().id, "openai");
  assert.equal(openaiOAuth().id, "openai-oauth");
  assert.deepEqual(openaiOAuth().metadata.authModes, ["oauth", "device-code"]);
  assert.deepEqual(copilot().metadata.authModes, ["device-code", "environment"]);
});
