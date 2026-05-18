import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provider picker example uses provider metadata APIs", async () => {
  const source = await readFile(new URL("../examples/provider-picker.ts", import.meta.url), "utf8");

  assert.match(source, /listProviderMetadata/);
  assert.match(source, /registerAllProviders/);
  assert.match(source, /createModel/);
  assert.match(source, /authModes/);
  assert.match(source, /runtimeOptions/);
  assert.match(source, /DOCKLINE_RUN/);
  assert.match(source, /redactSecrets/);
});

test("discovery example covers connection and model discovery flow", async () => {
  const source = await readFile(new URL("../examples/discovery.ts", import.meta.url), "utf8");

  assert.match(source, /listProviderMetadata/);
  assert.match(source, /testProviderConnection/);
  assert.match(source, /listProviderModels/);
  assert.match(source, /createModel/);
  assert.match(source, /providerOptions/);
});
