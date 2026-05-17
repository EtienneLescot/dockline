import {
  globalProviderRegistry,
  listProviderMetadata,
  type ProviderAuthMode,
  type ProviderMetadata,
  type RuntimeOptionDescriptor,
} from "@dockline/core";
import * as providers from "@dockline/providers";

declare const process: {
  stdout: { write(chunk: string): void };
};

/*
Run after building the workspace packages:

  npm run build
  npx tsx examples/provider-picker.ts

This example is intentionally network-free. It shows the first step in an
integrator provider picker: list provider metadata, expose supported auth modes,
and prepare runtime option controls before asking for credentials.
*/

registerProviderCatalog();

for (const metadata of listProviderMetadata()) {
  renderProvider(metadata);
}

function registerProviderCatalog(): void {
  for (const factory of [
    providers.openrouter,
    providers.openaiCompatible,
    providers.openai,
    providers.anthropic,
    providers.google,
    providers.mistral,
    providers.deepseek,
    providers.moonshot,
    providers.minimax,
    providers.alibaba,
    providers.copilot,
    providers.openaiOAuth,
  ]) {
    globalProviderRegistry.set(factory());
  }
}

function renderProvider(metadata: ProviderMetadata): void {
  process.stdout.write(`${metadata.displayName} (${metadata.id})\n`);
  process.stdout.write(`  backing: ${metadata.backing ?? "custom"}\n`);
  process.stdout.write(`  auth: ${renderAuthModes(metadata.authModes)}\n`);
  process.stdout.write(`  connection test: ${metadata.supportsConnectionTest ? "yes" : "no"}\n`);
  process.stdout.write(`  model discovery: ${metadata.supportsModelDiscovery ? "yes" : "no"}\n`);
  process.stdout.write(`  runtime options: ${renderRuntimeOptions(metadata.runtimeOptions)}\n\n`);
}

function renderAuthModes(authModes: ProviderAuthMode[]): string {
  return authModes.length > 0 ? authModes.join(", ") : "none declared";
}

function renderRuntimeOptions(options: RuntimeOptionDescriptor[] | undefined): string {
  if (!options || options.length === 0) return "none declared";

  return options
    .map((option) => {
      const category = option.category ? `${option.category}:` : "";
      const label = option.displayName ?? option.id;
      return `${category}${label}`;
    })
    .join(", ");
}
