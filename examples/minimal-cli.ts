import { createModel, type BaseModelConfig, type ModelEvent } from "@dockline/core";
import { registerOpenAICompatibleProvider } from "@dockline/openai-compatible";
import { registerOpenRouterProvider } from "@dockline/openrouter";

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  stderr: { write(chunk: string): void };
  stdout: { write(chunk: string): void };
};

/*
Run after building the workspace packages:

  npm run build
  PROVIDER=openrouter OPENROUTER_API_KEY=... npx tsx examples/minimal-cli.ts "Say hello"

  PROVIDER=openai-compatible \
    OPENAI_COMPATIBLE_BASE_URL=http://localhost:4000/v1 \
    OPENAI_COMPATIBLE_MODEL=my-model \
    npx tsx examples/minimal-cli.ts "Say hello"
*/

type ProviderName = "openrouter" | "openai-compatible";

registerOpenAICompatibleProvider();
registerOpenRouterProvider();

const provider = readProvider();
const prompt = process.argv.slice(2).join(" ").trim() || "Explain Dockline in one sentence.";
const model = await createModel(toModelConfig(provider));

for await (const event of model.stream({
  messages: [{ role: "user", content: prompt }],
})) {
  renderEvent(event);
}

process.stdout.write("\n");

function readProvider(): ProviderName {
  const provider = process.env.PROVIDER ?? process.env.DOCKLINE_PROVIDER ?? "openrouter";

  if (provider === "openrouter" || provider === "openai-compatible") {
    return provider;
  }

  throw new Error(
    `Unsupported provider "${provider}". Set PROVIDER to "openrouter" or "openai-compatible".`,
  );
}

function toModelConfig(provider: ProviderName): BaseModelConfig {
  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("Set OPENROUTER_API_KEY when PROVIDER=openrouter.");
    }

    return {
      provider,
      apiKey,
      model: process.env.OPENROUTER_MODEL ?? process.env.MODEL_NAME ?? "openai/gpt-4o-mini",
      appName: process.env.OPENROUTER_APP_NAME,
      appURL: process.env.OPENROUTER_APP_URL,
    };
  }

  return {
    provider,
    baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:4000/v1",
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL ?? process.env.MODEL_NAME ?? "my-model",
  };
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
