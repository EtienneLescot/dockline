import { createModel } from "@dockline/core";
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("Set OPENROUTER_API_KEY before running this example.");
}

const model = await createModel({
  provider: "openrouter",
  model: process.env.MODEL_NAME ?? "openai/gpt-4o-mini",
  apiKey,
});

for await (const event of model.stream({
  messages: [{ role: "user", content: "Explain Dockline in one sentence." }],
})) {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
  }
}

process.stdout.write("\n");
