import { createModel } from "@dockline/core";
import { registerOpenAICompatibleProvider } from "@dockline/openai-compatible";

registerOpenAICompatibleProvider();

const model = await createModel({
  provider: "openai-compatible",
  baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:4000/v1",
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  model: process.env.OPENAI_COMPATIBLE_MODEL ?? "my-model",
});

for await (const event of model.stream({
  messages: [{ role: "user", content: "Explain Dockline in one sentence." }],
})) {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
  }
}

process.stdout.write("\n");
