import {
  createModel,
  listProviderMetadata,
  listProviderModels,
  testProviderConnection,
  type BaseModelConfig,
  type GenerateInput,
  type ModelDescriptor,
  type ProviderAuthMode,
  type ProviderDiscoveryConfig,
  type ProviderMetadata,
} from "@dockline/core";
import { registerOpenAICompatibleProvider } from "@dockline/openai-compatible";
import { registerOpenRouterProvider } from "@dockline/openrouter";

declare const process: {
  env: Record<string, string | undefined>;
  stdout: { write(chunk: string): void };
};

/*
Run after building the workspace packages:

  npm run build
  PROVIDER=openrouter OPENROUTER_API_KEY=... npx tsx examples/discovery.ts

  PROVIDER=openai-compatible \
    OPENAI_COMPATIBLE_BASE_URL=http://localhost:4000/v1 \
    OPENAI_COMPATIBLE_API_KEY=... \
    npx tsx examples/discovery.ts

This example shows an integrator flow:

  1. list provider metadata
  2. choose an auth mode
  3. test the provider connection
  4. list account-visible models
  5. choose model and runtime options
  6. create a model with the selected config
*/

type SupportedProvider = "openrouter" | "openai-compatible";

registerOpenAICompatibleProvider();
registerOpenRouterProvider();

const providerId = readProviderId();
const metadata = requireProviderMetadata(providerId);
const auth = chooseAuthMode(metadata);
const discoveryConfig = toDiscoveryConfig(providerId, auth);

renderMetadata(metadata, auth);

const models = await listProviderModels(discoveryConfig);
const selectedModel = chooseModel(models, providerId);
const modelConfig: BaseModelConfig = {
  ...discoveryConfig,
  model: selectedModel.id,
};

const connection = await testProviderConnection(modelConfig);

if (!connection.ok) {
  throw new Error(connection.message ?? `Connection test failed: ${connection.status}`);
}

const providerOptions = chooseProviderOptions(metadata);
const model = await createModel(modelConfig);
const request: GenerateInput = {
  messages: [{ role: "user", content: "Explain Dockline discovery in one sentence." }],
  providerOptions,
};

process.stdout.write(`Connected to ${connection.provider}/${connection.model}\n`);
process.stdout.write(`Selected model: ${selectedModel.displayName ?? selectedModel.id}\n`);
process.stdout.write(`Provider options: ${JSON.stringify(providerOptions)}\n`);
process.stdout.write(`Model is ready: ${model.provider}/${model.id}\n`);
process.stdout.write(`Example request: ${JSON.stringify(request, null, 2)}\n`);

function readProviderId(): SupportedProvider {
  const provider = process.env.PROVIDER ?? process.env.DOCKLINE_PROVIDER ?? "openrouter";

  if (provider === "openrouter" || provider === "openai-compatible") {
    return provider;
  }

  throw new Error(
    `Unsupported provider "${provider}". Set PROVIDER to "openrouter" or "openai-compatible".`,
  );
}

function requireProviderMetadata(providerId: SupportedProvider): ProviderMetadata {
  const metadata = listProviderMetadata().find((provider) => provider.id === providerId);

  if (!metadata) {
    throw new Error(`Provider "${providerId}" is not registered.`);
  }

  return metadata;
}

function chooseAuthMode(metadata: ProviderMetadata): ProviderAuthMode {
  const requested = process.env.DOCKLINE_AUTH_MODE;

  if (requested) {
    if (metadata.authModes.includes(requested)) return requested;
    throw new Error(`Provider "${metadata.id}" does not advertise auth mode "${requested}".`);
  }

  return metadata.authModes[0] ?? "api-key";
}

function toDiscoveryConfig(
  provider: SupportedProvider,
  auth: ProviderAuthMode,
): ProviderDiscoveryConfig {
  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("Set OPENROUTER_API_KEY when PROVIDER=openrouter.");
    }

    return {
      provider,
      auth,
      apiKey,
      appName: process.env.OPENROUTER_APP_NAME,
      appURL: process.env.OPENROUTER_APP_URL,
    };
  }

  return {
    provider,
    auth,
    baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:4000/v1",
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    headers: readOptionalHeader("OPENAI_COMPATIBLE_HEADER"),
  };
}

function chooseModel(models: ModelDescriptor[], provider: SupportedProvider): ModelDescriptor {
  const requestedModel =
    provider === "openrouter"
      ? process.env.OPENROUTER_MODEL ?? process.env.MODEL_NAME
      : process.env.OPENAI_COMPATIBLE_MODEL ?? process.env.MODEL_NAME;

  if (requestedModel) {
    const exactMatch = models.find((model) => model.id === requestedModel);
    if (exactMatch) return exactMatch;

    throw new Error(`Model "${requestedModel}" was not returned by ${provider} discovery.`);
  }

  const preferred = provider === "openrouter"
    ? models.find((model) => model.id === "openai/gpt-4o-mini")
    : undefined;

  const selected = preferred ?? models[0];

  if (!selected) {
    throw new Error(`No models were returned by ${provider} discovery.`);
  }

  return selected;
}

function chooseProviderOptions(metadata: ProviderMetadata): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (const option of metadata.runtimeOptions ?? []) {
    const envName = `DOCKLINE_OPTION_${option.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    const rawValue = process.env[envName];

    if (rawValue === undefined) continue;
    options[option.id] = parseRuntimeOption(rawValue, option.type);
  }

  const reasoningEffort = process.env.REASONING_EFFORT;
  if (reasoningEffort) {
    options.reasoning = { effort: reasoningEffort };
  }

  return options;
}

function parseRuntimeOption(value: string, type: string): string | number | boolean {
  if (type === "boolean") return value === "true" || value === "1";
  if (type === "number" || type === "integer") return Number(value);
  return value;
}

function readOptionalHeader(envName: string): Record<string, string> | undefined {
  const header = process.env[envName];
  if (!header) return undefined;

  const separator = header.indexOf(":");
  if (separator === -1) {
    throw new Error(`${envName} must use "Header-Name: value" format.`);
  }

  return {
    [header.slice(0, separator).trim()]: header.slice(separator + 1).trim(),
  };
}

function renderMetadata(metadata: ProviderMetadata, auth: ProviderAuthMode): void {
  process.stdout.write(`Provider: ${metadata.displayName} (${metadata.id})\n`);
  process.stdout.write(`Auth mode: ${auth}\n`);
  process.stdout.write(`Model discovery: ${metadata.supportsModelDiscovery ? "yes" : "no"}\n`);
  process.stdout.write(`Connection test: ${metadata.supportsConnectionTest ? "yes" : "no"}\n`);
}
