# Alpha Release Notes

Dockline `0.1.0-alpha.2` should be the first alpha that reflects the new product
center:

> provider catalog + connector resolver for JS/TS agentic apps.

`0.1.0-alpha.1` shipped the initial core/connectors. The next alpha should ship
the catalog pivot and avoid presenting Dockline as a generic provider SDK clone.

## What Ships Now

- `@dockline/catalog`: user-facing provider catalog aggregated from Vercel AI
  SDK, LangChain, and Dockline-native account-backed gaps.
- `@dockline/resolver`: backing-neutral connector resolver for catalog
  providers.
- `@dockline/core`: contracts, messages, streaming events, provider registry,
  discovery helpers, normalized errors, token stores, and alpha auth/runtime
  contracts.
- `@dockline/ai-sdk`: structural Vercel AI SDK `LanguageModelV3` bridge.
- `@dockline/openai-compatible`: generic OpenAI-compatible chat completions
  connector with streaming, tool calls, model discovery, connection tests, and
  reasoning deltas.
- `@dockline/openrouter`: OpenRouter gateway connector on the
  OpenAI-compatible transport.
- `@dockline/openai`, `@dockline/anthropic`, `@dockline/google`,
  `@dockline/mistral`: current LangChain-backed API-key provider packages.
- `@dockline/providers`: explicit executable provider factories, including
  OpenAI-compatible presets for DeepSeek, Moonshot/Kimi, MiniMax, and
  Alibaba/Qwen.
- `@dockline/all`: convenience bundle that re-exports the catalog, bridges, and
  current provider factories.
- `@dockline/langchain` and `@dockline/langchain-provider`: LangChain adapter
  and bridge package.

## Quick Try

```bash
npm install
npm run build
node --test test/catalog.test.mjs
```

Catalog usage:

```ts
import { listCatalogProviders } from "@dockline/catalog";

const providers = listCatalogProviders();
```

Live OpenRouter stream through the existing example:

```bash
DOCKLINE_RUN=1 \
DOCKLINE_PROVIDER=openrouter \
OPENROUTER_API_KEY=... \
DOCKLINE_MODEL=openai/gpt-4o-mini \
npx tsx examples/provider-picker.ts
```

## Known Alpha Limits

- Catalog presence does not mean an executable connector is already installed.
- The connector resolver is initial/static; richer package and environment
  diagnostics are planned next.
- Provider metadata is provider-level guidance, not a model capability catalog.
- LangChain-backed provider packages require their optional peer dependencies
  for live calls.
- OAuth/PKCE and device-code contracts are alpha-only and provider-neutral; no
  official-auth connector or CLI is shipped yet.
- `npm publish` is not automated from this repo.

## Publish Checklist

Run before publishing:

```bash
npm run build
npm run typecheck
npm test
npm run pack:dry-run
```

Then publish workspaces intentionally after a version bump:

```bash
npm publish --workspaces --access public --tag alpha
```

Publishing remains an explicit human decision.
