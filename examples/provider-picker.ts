import {
  createModel,
  listProviderMetadata,
  type BaseModelConfig,
  type ModelEvent,
  type ProviderAuthMode,
  type ProviderMetadata,
  type RuntimeOptionDescriptor,
} from "@dockline/core";
import { registerAllProviders } from "@dockline/all";

declare const process: {
  env: Record<string, string | undefined>;
  stderr: { write(chunk: string): void };
  stdout: { write(chunk: string): void };
};

/*
Run after building the workspace packages:

  npm run build
  npx tsx examples/provider-picker.ts

Dry-run is the default. It renders provider-picker metadata and the config that
would be used for the selected provider.

Live stream example:

  DOCKLINE_RUN=1 \
    DOCKLINE_PROVIDER=openrouter \
    OPENROUTER_API_KEY=... \
    DOCKLINE_MODEL=openai/gpt-4o-mini \
    npx tsx examples/provider-picker.ts

For LangChain-backed providers such as OpenAI, Anthropic, Google, or Mistral,
install the matching optional peer dependency before running live.
*/

registerAllProviders();

const providers = listProviderMetadata();
const selectedProvider = selectProvider(providers);
const authMode = selectAuthMode(selectedProvider);
const runtimeOptions = readRuntimeOptions(selectedProvider.runtimeOptions);
const modelConfig = toModelConfig(selectedProvider, authMode);

renderCatalog(providers, selectedProvider.id);
renderSelection(selectedProvider, authMode, modelConfig, runtimeOptions);

if (isLiveRun()) {
  await streamWithSelection(modelConfig, runtimeOptions);
} else {
  process.stdout.write("\nDry-run only. Set DOCKLINE_RUN=1 to create the model and stream.\n");
}

function selectProvider(providers: ProviderMetadata[]): ProviderMetadata {
  const providerId = process.env.DOCKLINE_PROVIDER ?? process.env.PROVIDER ?? "openrouter";
  const metadata = providers.find((provider) => provider.id === providerId);

  if (!metadata) {
    throw new Error(
      `Unknown provider "${providerId}". Available providers: ${providers.map((provider) => provider.id).join(", ")}`,
    );
  }

  return metadata;
}

function selectAuthMode(metadata: ProviderMetadata): ProviderAuthMode {
  const requested = process.env.DOCKLINE_AUTH_MODE;

  if (requested) {
    if (metadata.authModes.includes(requested)) return requested;
    throw new Error(`Provider "${metadata.id}" does not advertise auth mode "${requested}".`);
  }

  return metadata.authModes[0] ?? "api-key";
}

function toModelConfig(metadata: ProviderMetadata, auth: ProviderAuthMode): BaseModelConfig {
  const model = readRequiredModel(metadata.id);
  const config: BaseModelConfig = {
    provider: metadata.id,
    model,
    auth,
  };

  const apiKey = readApiKey(metadata.id);
  if (apiKey) config.apiKey = apiKey;
  if (isLiveRun() && requiresApiKey(metadata.id, auth) && !apiKey) {
    throw new Error(`Set ${envPrefix(metadata.id)}_API_KEY before running provider "${metadata.id}" live.`);
  }

  if (metadata.id === "openai-compatible") {
    config.baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:4000/v1";
  }

  if (metadata.id === "openrouter") {
    config.appName = process.env.OPENROUTER_APP_NAME;
    config.appURL = process.env.OPENROUTER_APP_URL;
  }

  return stripUndefined(config) as BaseModelConfig;
}

function readRequiredModel(providerId: string): string {
  const model = process.env.DOCKLINE_MODEL
    ?? process.env.MODEL_NAME
    ?? modelEnv(providerId)
    ?? defaultModel(providerId);

  if (!model) {
    throw new Error(`Set DOCKLINE_MODEL or ${modelEnvName(providerId)} for provider "${providerId}".`);
  }

  return model;
}

function modelEnv(providerId: string): string | undefined {
  return process.env[modelEnvName(providerId)];
}

function defaultModel(providerId: string): string | undefined {
  if (providerId === "openrouter") return "openai/gpt-4o-mini";
  if (providerId === "openai-compatible") return "my-model";
  if (providerId === "deepseek") return "deepseek-chat";
  if (providerId === "moonshot") return "kimi-k2-0711-preview";
  if (providerId === "minimax") return "MiniMax-M2";
  if (providerId === "alibaba") return "qwen-plus";
  return undefined;
}

function modelEnvName(providerId: string): string {
  return `${envPrefix(providerId)}_MODEL`;
}

function readApiKey(providerId: string): string | undefined {
  return process.env[`${envPrefix(providerId)}_API_KEY`];
}

function requiresApiKey(providerId: string, auth: ProviderAuthMode): boolean {
  return auth === "api-key" && providerId !== "openai-compatible";
}

function envPrefix(providerId: string): string {
  if (providerId === "openai-compatible") return "OPENAI_COMPATIBLE";
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function readRuntimeOptions(options: RuntimeOptionDescriptor[] | undefined): Record<string, unknown> {
  const runtimeOptions: Record<string, unknown> = {};

  for (const option of options ?? []) {
    const envName = optionEnvName(option.id);
    const raw = process.env[envName];

    if (raw === undefined) continue;
    setDottedValue(runtimeOptions, option.id, parseRuntimeOption(raw, option.type));
  }

  return runtimeOptions;
}

function optionEnvName(optionId: string): string {
  return `DOCKLINE_OPTION_${optionId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

function parseRuntimeOption(value: string, type: RuntimeOptionDescriptor["type"]): string | number | boolean {
  if (type === "boolean") return value === "true" || value === "1";
  if (type === "number" || type === "integer") return Number(value);
  return value;
}

function setDottedValue(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let cursor = target;

  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]] = value;
}

function renderCatalog(providers: ProviderMetadata[], selectedProviderId: string): void {
  process.stdout.write("Available providers\n");

  for (const provider of providers) {
    const marker = provider.id === selectedProviderId ? "*" : "-";
    process.stdout.write(
      `${marker} ${provider.displayName} (${provider.id}) auth=${renderAuthModes(provider.authModes)} backing=${provider.backing ?? "custom"}\n`,
    );
  }
}

function renderSelection(
  metadata: ProviderMetadata,
  authMode: ProviderAuthMode,
  modelConfig: BaseModelConfig,
  runtimeOptions: Record<string, unknown>,
): void {
  process.stdout.write(`\nSelected provider: ${metadata.displayName} (${metadata.id})\n`);
  process.stdout.write(`Auth mode: ${authMode}\n`);
  process.stdout.write(`Model discovery: ${metadata.supportsModelDiscovery ? "yes" : "no"}\n`);
  process.stdout.write(`Connection test: ${metadata.supportsConnectionTest ? "yes" : "no"}\n`);
  process.stdout.write("Runtime controls:\n");

  for (const option of metadata.runtimeOptions ?? []) {
    process.stdout.write(`  - ${option.displayName ?? option.id} [${option.id}] via ${optionEnvName(option.id)}\n`);
  }

  if (!metadata.runtimeOptions || metadata.runtimeOptions.length === 0) {
    process.stdout.write("  none declared\n");
  }

  process.stdout.write(`Model config: ${redactSecrets(modelConfig)}\n`);
  process.stdout.write(`Runtime options: ${JSON.stringify(runtimeOptions, null, 2)}\n`);
}

function renderAuthModes(authModes: ProviderAuthMode[]): string {
  return authModes.length > 0 ? authModes.join(",") : "none";
}

async function streamWithSelection(
  modelConfig: BaseModelConfig,
  providerOptions: Record<string, unknown>,
): Promise<void> {
  const model = await createModel(modelConfig);
  const prompt = process.env.DOCKLINE_PROMPT ?? "Explain Dockline provider selection in one sentence.";

  process.stdout.write("\nStreaming response\n");

  for await (const event of model.stream({
    messages: [{ role: "user", content: prompt }],
    providerOptions,
  })) {
    renderEvent(event);
  }

  process.stdout.write("\n");
}

function renderEvent(event: ModelEvent): void {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
    return;
  }

  if (event.type === "reasoning-delta") {
    process.stderr.write(event.text);
    return;
  }

  if (event.type === "tool-call") {
    process.stderr.write(`\n[tool-call] ${event.toolCall.name} ${JSON.stringify(event.toolCall.arguments)}\n`);
    return;
  }

  if (event.type === "usage") {
    process.stderr.write(`\n[usage] ${JSON.stringify(event.usage)}\n`);
    return;
  }

  if (event.type === "error") {
    process.stderr.write(`\n[error] ${event.error.code}: ${event.error.message}\n`);
  }
}

function isLiveRun(): boolean {
  return process.env.DOCKLINE_RUN === "1" || process.env.DOCKLINE_RUN === "true";
}

function stripUndefined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function redactSecrets(value: unknown): string {
  return JSON.stringify(
    value,
    (key, item) => key.toLowerCase().includes("key") && typeof item === "string" ? "[redacted]" : item,
    2,
  );
}
