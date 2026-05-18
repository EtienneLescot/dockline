# Dockline

Dockline is an open provider catalog and connector resolver for JS/TS agentic
applications.

It is not an agent framework, a provider SDK clone, or a hosted gateway. It is
the code-side layer an application uses to offer users a clean provider picker:
provider, auth method, model, runtime options, and then the best available
connector backing.

Alpha package: `0.1.0-alpha.1`.

## Product Promise

A developer should be able to plug Dockline into an agentic app and expose model
access choices such as:

- OpenAI with an API key
- Anthropic with an API key
- Google Gemini with an API key
- OpenRouter with an OpenRouter key
- Vercel AI Gateway with Vercel Gateway credentials
- a local OpenAI-compatible endpoint
- a ChatGPT account through official OAuth/device flows when available
- GitHub Copilot through official device flow or SDK-delegated auth

Dockline's job is to aggregate the provider choices that already exist across
Vercel AI SDK and LangChain, add the account-backed providers they do not solve
cleanly, and expose one coherent integration surface to host applications.

## Definitions

A provider is whoever supplies model access credentials:

- OpenAI is a provider.
- OpenRouter is a provider/gateway.
- Vercel AI Gateway is a provider/gateway.
- Ollama and LM Studio are local runtime providers.
- Vercel AI SDK is not a provider; it is an adapter library.
- LangChain is not a provider; it is an adapter library.
- Dockline is not a gateway SaaS; it is the open code-side aggregator.

## Quickstart: Provider Picker Catalog

Install the catalog package:

```bash
npm install @dockline/catalog
```

List provider choices for your picker:

```ts
import { listCatalogProviders } from "@dockline/catalog";

const providers = listCatalogProviders();

for (const provider of providers) {
  console.log(provider.id, provider.displayName, {
    kind: provider.providerKind,
    authModes: provider.authModes,
    sources: provider.sources.map((source) => source.id),
    recommendedBacking: provider.recommendedBacking,
  });
}
```

Filter by UX need:

```ts
const gateways = listCatalogProviders({ providerKind: "gateway" });
const accountBacked = listCatalogProviders({ source: "dockline-native" });
const deviceCode = listCatalogProviders({ authMode: "device-code" });
```

## Quickstart: Existing Connector

Dockline still ships executable connector packages. For example, OpenRouter:

```bash
npm install @dockline/core @dockline/openrouter
```

```ts
import { createModel } from "@dockline/core";
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();

const model = await createModel({
  provider: "openrouter",
  model: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_API_KEY,
});

for await (const event of model.stream({
  messages: [{ role: "user", content: "Create a HubSpot to Airtable sync workflow." }],
})) {
  if (event.type === "text-delta") process.stdout.write(event.text);
}
```

For an OpenAI-compatible endpoint:

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
```

## Backing Strategy

Dockline does not want to own provider API debt when good upstream adapters
already exist.

The pragmatic strategy is:

1. Use Vercel AI SDK providers as the primary upstream directory/backing.
2. Add LangChain JS chat providers missing from AI SDK.
3. Treat gateways as real user-selectable providers.
4. Build Dockline-native connectors only for gaps: official OAuth/device flows,
   account-backed access, IDE environment APIs, and agent runtimes.

## Current Packages

- `@dockline/catalog`: user-facing provider catalog aggregated from AI SDK,
  LangChain, and Dockline-native gaps
- `@dockline/core`: common contracts, registry, messages, streaming events,
  normalized errors, discovery hooks, and token-store interfaces
- `@dockline/ai-sdk`: structural Vercel AI SDK `LanguageModelV3` bridge
- `@dockline/langchain`: structural LangChain/LangGraph JS adapter
- `@dockline/langchain-provider`: structural LangChain-to-Dockline provider bridge
- `@dockline/openai-compatible`: generic OpenAI-compatible chat completions connector
- `@dockline/openrouter`: OpenRouter connector built on the OpenAI-compatible transport
- `@dockline/providers`: current explicit executable provider factories
- `@dockline/all`: convenience bundle that re-exports the catalog and current providers
- `@dockline/openai`, `@dockline/anthropic`, `@dockline/google`,
  `@dockline/mistral`: current LangChain-backed API-key provider packages

## Non-Goals

Dockline is not:

- an agent framework
- a LangChain clone
- a Vercel AI SDK clone
- a LiteLLM clone
- a SaaS gateway
- a GUI
- a token scraper
- a private endpoint workaround
- a market-wide database of every model capability

## Design Docs

- [Product spec](docs/product-spec.md): new product positioning and success criteria.
- [Provider catalog](docs/provider-catalog.md): user-facing provider list, source calculation, gateway treatment, and catalog metadata.
- [Provider routing](docs/provider-routing.md): connector resolver plan and backing selection.
- [Provider coverage](docs/provider-coverage.md): upstream directory and coverage strategy.
- [Provider discovery](docs/discovery.md): connection testing, model listing, and picker flow.
- [Auth UX design](docs/auth-design.md): API-key, OAuth/device/headless, Copilot, and token-plan auth boundaries.
- [Alpha release notes](docs/release-alpha.md): current package surface, known limits, and publish checklist.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```
