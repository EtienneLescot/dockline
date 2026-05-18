# Provider Coverage Strategy

Dockline's coverage strategy is pragmatic aggregation.

The goal is broad user-facing provider choice without owning all provider API
implementations.

## Source Of Truth

`@dockline/catalog` is the source of truth for provider-picker metadata.

The catalog is calculated as:

1. Vercel AI SDK providers as the primary upstream directory.
2. LangChain JS chat providers that are absent from the AI SDK directory.
3. Dockline-native gaps: official OAuth/device/account-backed providers,
   environment APIs, and agent runtimes.

Each catalog entry records its origins, provider kind, auth modes, recommended
backing, available backings, and capability groups.

## Why AI SDK First

Vercel AI SDK is a good primary backing because:

- it has a focused language-model provider contract;
- it is JS/TS-first;
- it covers many mainstream API-key providers;
- its provider ecosystem already includes community providers;
- it maps well to Dockline's need to delegate transport debt.

This does not make Vercel AI Gateway the catalog. Vercel AI Gateway is just one
provider/gateway inside the catalog.

## Why LangChain Still Matters

LangChain remains useful as a complement because it has JS chat integrations that
AI SDK may not cover and because many agentic applications already use
LangChain/LangGraph.

LangChain should not define duplicate user-facing provider entries when AI SDK
already covers the same provider. Instead, the catalog entry should record both
sources and the resolver can choose a backing.

## Gateway Treatment

Gateways are providers:

- OpenRouter
- Vercel AI Gateway
- Portkey
- Requesty
- LangDB
- OpenAI-compatible gateways such as LiteLLM

A gateway's model list is scoped to that gateway and its account. Dockline may
use gateway discovery APIs, but the selected provider remains the gateway.

## Native Dockline Coverage

Native Dockline packages are justified when:

- the provider needs official OAuth/PKCE/device auth;
- the provider is account-backed rather than API-key backed;
- the auth comes from an environment such as VS Code;
- the runtime is an agent/coding runtime rather than a chat model;
- upstream adapters are missing a major provider;
- upstream behavior is too incomplete or ambiguous for the intended UX.

Native Dockline packages are not justified merely because a provider exists.

## Current Native/Direct Connectors

Already implemented:

- `openrouter`
- `openai-compatible`
- LangChain-backed API-key packages for OpenAI, Anthropic, Google, and Mistral
- OpenAI-compatible presets for DeepSeek, Moonshot, MiniMax, and Alibaba

These are useful, but they are no longer the strategic center of the repository.
The strategic center is the catalog and resolver.

## Missing Strategic Pieces

Next coverage work:

- connector resolver;
- AI SDK executable backing for catalog entries;
- Vercel AI Gateway provider/gateway handling;
- package-install diagnostics;
- account-backed native connectors:
  - OpenAI ChatGPT account
  - GitHub Copilot
  - VS Code LM API
  - Codex/CLI/runtime access

## Guardrails

- `@dockline/core` must not depend on AI SDK, LangChain, or provider SDKs.
- Provider ids must remain stable even if the backing changes.
- API-key auth and account-backed auth should stay separate.
- No token scraping.
- No private undocumented endpoints.
- Model capabilities remain runtime/discovery output, not a static database in
  core.

## References

- Vercel AI SDK providers:
  <https://ai-sdk.dev/providers/ai-sdk-providers>
- Vercel AI SDK provider architecture:
  <https://ai-sdk.dev/docs/foundations/providers-and-models>
- LangChain JS provider list:
  <https://docs.langchain.com/oss/javascript/integrations/providers/all_providers>
