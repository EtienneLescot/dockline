# Dockline

Dockline is a capability-aware model connector layer for JS/TS agentic applications.

It is not an agent framework. It is the lower-level model/runtime connection layer that an agent, CLI, IDE extension, workflow orchestrator, or SaaS app can use to connect to model APIs, OpenAI-compatible endpoints, gateways, subscription-backed sources, and agent runtimes through explicit capabilities.

Alpha package: `0.1.0-alpha.1`.

## Quickstart

Install the core package and at least one provider package:

```bash
npm install @dockline/core @dockline/openrouter
```

Register providers once at application startup, before calling `createModel`:

```ts
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();
```

Create a model with the registered provider id and call `generate` or `stream`:

```ts
import { createModel } from "@dockline/core";
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("Set OPENROUTER_API_KEY before using OpenRouter.");
}

const model = await createModel({
  provider: "openrouter",
  model: "openai/gpt-4o-mini",
  apiKey,
});

for await (const event of model.stream({
  messages: [{ role: "user", content: "Create a HubSpot to Airtable sync workflow." }],
})) {
  if (event.type === "text-delta") process.stdout.write(event.text);
}
```

For any OpenAI-compatible `/chat/completions` endpoint, install and register the generic provider instead:

```bash
npm install @dockline/core @dockline/openai-compatible
```

```ts
import { createModel } from "@dockline/core";
import { registerOpenAICompatibleProvider } from "@dockline/openai-compatible";

registerOpenAICompatibleProvider();

const model = await createModel({
  provider: "openai-compatible",
  baseURL: "http://localhost:4000/v1",
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  model: "my-model",
});

const result = await model.generate({
  messages: [{ role: "user", content: "Explain Dockline in one sentence." }],
});

console.log(result.text);
```

To delegate long-tail provider coverage to the Vercel AI SDK, wrap any AI SDK
`LanguageModelV3` provider with `@dockline/ai-sdk`:

```bash
npm install @dockline/core @dockline/ai-sdk @ai-sdk/openai
```

```ts
import { openai } from "@ai-sdk/openai";
import { createModel, globalProviderRegistry } from "@dockline/core";
import { createAISDKChatProvider } from "@dockline/ai-sdk";

globalProviderRegistry.set(createAISDKChatProvider({
  id: "openai-ai-sdk",
  displayName: "OpenAI via AI SDK",
  metadata: { authModes: ["api-key"] },
  createLanguageModel: (config) => openai(config.model),
}));

const model = await createModel({
  provider: "openai-ai-sdk",
  model: "gpt-4.1-mini",
});
```

## Why

Every JS agent framework still makes you bring your own model glue:

- provider configuration
- authentication differences
- streaming formats
- tool calling formats
- structured output support
- capability detection
- OpenAI-compatible endpoints and gateways
- future subscription-backed connectors such as Codex, Copilot, or VS Code LM

Dockline keeps that concern separate from agent orchestration.

## Design Principles

- TypeScript first
- framework agnostic
- capability-aware, not provider-flat
- modular providers
- no required dependency on Vercel, LangChain, Next.js, or any agent framework
- no token scraping or private endpoint workarounds
- honest capability reporting instead of pretending every model can do everything

## Packages

Current alpha packages:

- `@dockline/core`: common interfaces, message types, events, capabilities, errors, provider registry
- `@dockline/openai-compatible`: generic OpenAI-compatible chat completions connector
- `@dockline/openrouter`: OpenRouter provider built on the OpenAI-compatible connector
- `@dockline/catalog`: provider-picker catalog aggregated from AI SDK, LangChain, and Dockline-native gaps
- `@dockline/ai-sdk`: structural Vercel AI SDK `LanguageModelV3` bridge
- `@dockline/langchain`: structural LangChain/LangGraph JS adapter for Dockline chat models
- `@dockline/langchain-provider`: structural LangChain-to-Dockline provider bridge
- `@dockline/providers`: explicit provider factory imports for provider-picker UX
- `@dockline/all`: optional convenience bundle for listing or registering every provider
- `@dockline/openai`: LangChain-backed OpenAI API-key provider
- `@dockline/anthropic`: LangChain-backed Anthropic API-key provider
- `@dockline/google`: LangChain-backed Google Gemini API-key provider
- `@dockline/mistral`: LangChain-backed Mistral API-key provider

Planned packages:

- `@dockline/codex`
- `@dockline/github-copilot`
- `@dockline/vscode-lm`
- `@dockline/deepagents`

## MVP Scope

Phase 0:

- core TypeScript interfaces
- streaming event model
- capabilities
- normalized errors
- provider registry
- config validation

Phase 1:

- OpenAI-compatible endpoint support
- OpenRouter support
- adapter for at least one agent framework

Phase 2:

- token store interfaces
- CLI auth flows where supported by official/documented APIs
- Codex/Copilot connectors only when a robust legal path exists

## Safety Boundary

Dockline must not use scraped tokens, private undocumented endpoints, or provider ToS workarounds. Subscription-backed connectors belong behind explicit provider packages and must rely on documented flows, official SDKs, or environment APIs.

## Design Docs

- [Provider catalog](docs/provider-catalog.md): user-facing provider list, source calculation, gateway treatment, and catalog metadata.
- [Provider routing](docs/provider-routing.md): provider package strategy, optional `@dockline/all`, and provider-picker metadata.
- [Provider discovery](docs/discovery.md): provider metadata, connection testing, model listing, and picker examples.
- [Auth UX design](docs/auth-design.md): API-key, OAuth/device/headless, Copilot, and token-plan auth boundaries.
- [Alpha release notes](docs/release-alpha.md): current package surface, known limits, and publish checklist.

## Examples

```bash
npm run build
npx tsx examples/provider-picker.ts
```

The provider-picker example runs as a dry-run by default. Set `DOCKLINE_RUN=1`
and provider credentials to create a model and stream a response.

## Development

```bash
npm install
npm test
npm run typecheck
```
