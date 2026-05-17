import {
  createModel,
  getMissingCapabilities,
  type BaseModelConfig,
  type ModelEvent,
  type ToolDefinition,
} from "@dockline/core";
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
  PROVIDER=openrouter OPENROUTER_API_KEY=... npx tsx examples/workflow-agent.ts

This is a workflow caller example, not an agent framework. It checks model
capabilities, sends a tool schema, and renders model events from one streamed
turn. A production agent would add planning, tool execution loops, memory,
retries, and policy boundaries around this core interaction.
*/

type ProviderName = "openrouter" | "openai-compatible";

registerOpenAICompatibleProvider();
registerOpenRouterProvider();

const tools = [
  {
    name: "lookup_order",
    description: "Look up a customer order by id.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The order id, for example ORD-123.",
        },
      },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
] satisfies ToolDefinition[];

const model = await createModel(toModelConfig(readProvider()));
const missingCapabilities = getMissingCapabilities(model.capabilities, ["streaming", "toolCalling"]);

if (missingCapabilities.length > 0) {
  throw new Error(
    `${model.provider}/${model.id} is missing required capabilities: ${missingCapabilities.join(", ")}`,
  );
}

renderWorkflowEvent("model", {
  provider: model.provider,
  id: model.id,
  toolCallingMode: model.toolCallingMode ?? "unspecified",
});
renderWorkflowEvent("tools", tools.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })));

for await (const event of model.stream({
  messages: [
    {
      role: "system",
      content:
        "You are a workflow step. Use the provided tool schema when an order lookup is required.",
    },
    {
      role: "user",
      content:
        process.argv.slice(2).join(" ").trim() ||
        "Check order ORD-123 and summarize what you would do next.",
    },
  ],
  tools,
})) {
  renderModelEvent(event);
}

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

function renderModelEvent(event: ModelEvent): void {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
    return;
  }

  if (event.type === "reasoning-delta") {
    renderWorkflowEvent("reasoning", event.text);
    return;
  }

  if (event.type === "tool-call") {
    renderWorkflowEvent("tool-call", event.toolCall);
    return;
  }

  if (event.type === "tool-result") {
    renderWorkflowEvent("tool-result", event.toolResult);
    return;
  }

  if (event.type === "usage") {
    renderWorkflowEvent("usage", event.usage);
    return;
  }

  if (event.type === "error") {
    renderWorkflowEvent("error", event.error);
    return;
  }

  renderWorkflowEvent("done", {});
}

function renderWorkflowEvent(type: string, payload: unknown): void {
  process.stderr.write(`[${type}] ${JSON.stringify(payload)}\n`);
}
