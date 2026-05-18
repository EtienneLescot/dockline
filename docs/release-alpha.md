# Alpha Release Notes

Dockline `0.1.0-alpha.0` is the first npm-ready alpha of the capability-aware
model connector layer for JS/TS agents.

## What Ships

- `@dockline/core`: chat model contracts, messages, streaming events,
  capabilities, provider registry, discovery helpers, normalized errors,
  memory/filesystem token stores, and alpha auth/runtime contracts under
  `@dockline/core/experimental`.
- `@dockline/openai-compatible`: generic OpenAI-compatible chat completions
  connector with streaming, tool calls, structured output request shape,
  model discovery, connection tests, and reasoning deltas.
- `@dockline/openrouter`: OpenRouter connector on the OpenAI-compatible
  transport.
- `@dockline/openai`, `@dockline/anthropic`, `@dockline/google`,
  `@dockline/mistral`: LangChain-backed API-key provider packages.
- `@dockline/providers`: explicit provider factories for provider-picker UX,
  including OpenAI-compatible presets for DeepSeek, Moonshot/Kimi, MiniMax, and
  Alibaba/Qwen.
- `@dockline/all`: optional convenience bundle for registering or listing all
  current provider factories.
- `@dockline/langchain` and `@dockline/langchain-provider`: LangChain adapter
  and bridge package.

## Quick Try

```bash
npm install
npm run build
npx tsx examples/provider-picker.ts
```

The provider-picker example is dry-run by default. It lists available providers,
auth modes, runtime controls, and the redacted config that would be used.

Live OpenRouter stream:

```bash
DOCKLINE_RUN=1 \
DOCKLINE_PROVIDER=openrouter \
OPENROUTER_API_KEY=... \
DOCKLINE_MODEL=openai/gpt-4o-mini \
npx tsx examples/provider-picker.ts
```

## Known Alpha Limits

- Provider metadata is provider-level guidance, not a model capability catalog.
- LangChain-backed provider packages require their optional peer dependencies
  for live calls.
- OAuth/PKCE and device-code contracts are alpha-only and provider-neutral;
  no official-auth connector or CLI is shipped yet.
- OpenAI-compatible presets share the generic transport. Native provider
  packages may be added later where provider-specific behavior justifies it.
- `npm publish` is not automated from this repo.

## Publish Checklist

Run before publishing:

```bash
npm run build
npm run typecheck
npm test
npm run pack:dry-run
```

Then publish workspaces intentionally:

```bash
npm publish --workspaces --access public --tag alpha
```

Only publish after confirming the `@dockline/*` package names and npm account
permissions. This operation is external and should remain an explicit human
decision.
