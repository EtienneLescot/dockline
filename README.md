# Dockline

Dockline is a capability-aware model connector layer for JS/TS agentic applications.

It is not an agent framework. It is the lower-level model/runtime connection layer that an agent, CLI, IDE extension, workflow orchestrator, or SaaS app can use to connect to model APIs, OpenAI-compatible endpoints, gateways, subscription-backed sources, and agent runtimes through explicit capabilities.

```ts
import { createModel } from "@dockline/core";
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();

const model = await createModel({
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4.5",
  apiKey: process.env.OPENROUTER_API_KEY,
});

for await (const event of model.stream({
  messages: [{ role: "user", content: "Create a HubSpot to Airtable sync workflow." }],
})) {
  if (event.type === "text-delta") process.stdout.write(event.text);
}
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

Current scaffold:

- `@dockline/core`: common interfaces, message types, events, capabilities, errors, provider registry
- `@dockline/openai-compatible`: generic OpenAI-compatible chat completions connector
- `@dockline/openrouter`: OpenRouter provider built on the OpenAI-compatible connector

Planned packages:

- `@dockline/ai-sdk`
- `@dockline/openai`
- `@dockline/anthropic`
- `@dockline/google`
- `@dockline/codex`
- `@dockline/github-copilot`
- `@dockline/vscode-lm`
- `@dockline/langchain`
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

## Development

```bash
npm install
npm run typecheck
```

