# Dockline Roadmap

This roadmap keeps Dockline focused on its actual wedge:

> provider catalog + auth choices + connector resolver for JS/TS agentic apps.

Dockline should not become a handwritten provider zoo, a hosted gateway, or an
agent framework.

Only remaining or active work is listed here. Completed items are removed from
the main checklist once they land.

## Phase 1 - Catalog Foundation

Goal: make Dockline useful before every provider has an executable connector.

- Keep `@dockline/catalog` as the source of truth for provider-picker metadata.
- Keep providers deduplicated across AI SDK, LangChain, and Dockline-native gaps.
- Preserve origin metadata:
  - `ai-sdk`
  - `langchain`
  - `dockline-native`
- Preserve provider kind metadata:
  - API provider
  - gateway
  - local runtime
  - account-backed provider
  - agent runtime
  - protocol
  - observability
- Keep gateways as providers, not directories.

Deliverable: a JS/TS app can render a broad provider picker from Dockline
metadata without manually copying AI SDK and LangChain provider lists.

## Phase 2 - Connector Resolver

Goal: turn catalog entries into executable connector choices.

- Expand the initial `@dockline/resolver` package from static candidates to
  richer package/environment-aware resolution.
- Add first-class install diagnostics and per-provider installation guidance.
- Add backing-specific candidate factories for AI SDK and LangChain.
- Keep returning clear unsupported/missing-package/planned errors instead of
  pretending every catalog entry is executable.

Deliverable: an app can select a catalog provider and get the correct executable
provider registration or a precise install/configuration error.

## Phase 3 - AI SDK Backing

Goal: use Vercel AI SDK as the primary executable backing for broad provider
coverage.

- Build helper factories that wrap common AI SDK providers into Dockline
  providers with catalog metadata.
- Keep provider packages optional and lazy.
- Document install commands per provider family.
- Normalize streaming, tool calls, structured output, usage, and provider
  options through the existing `@dockline/ai-sdk` bridge.

Deliverable: major API-key providers from the catalog can run through AI SDK
without Dockline owning their API implementations.

## Phase 4 - LangChain Complement

Goal: support providers present in LangChain but missing from AI SDK.

- Add LangChain-backed resolver entries only for catalog providers whose primary
  source is the LangChain complement.
- Keep LangChain as a complement, not the primary directory.
- Avoid duplicate user-facing providers when both AI SDK and LangChain support
  the same provider.

Deliverable: the user-facing provider list is broader than either upstream
catalog alone.

## Phase 5 - Gateways And OpenAI-Compatible Providers

Goal: make gateways first-class provider choices.

- Keep `openrouter` as a gateway provider.
- Add `vercel-ai-gateway` as a gateway provider/backing.
- Keep `openai-compatible` for custom endpoints and self-hosted gateways.
- Document gateway semantics clearly:
  - user authenticates with the gateway;
  - gateway model discovery is gateway-scoped;
  - routed upstream model providers are not the selected provider.
- Add provider-specific discovery and connection tests where documented.

Deliverable: a user can choose OpenRouter, Vercel AI Gateway, or a custom
OpenAI-compatible endpoint without architectural confusion.

## Phase 6 - Official Auth And Account-Backed Providers

Goal: solve the gaps AI SDK and LangChain usually do not solve.

- Add auth primitives and examples for:
  - API key
  - OAuth/PKCE
  - device code
  - environment-provided auth
  - SDK-delegated auth
- Keep account-backed packages separate from API-key providers.
- Add native connectors only where official/documented flows exist:
  - OpenAI ChatGPT account
  - GitHub Copilot
  - VS Code LM API
  - Codex/CLI/runtime access
- Add optional CLI commands later:
  - `dockline login`
  - `dockline logout`
  - `dockline status`

Deliverable: Dockline covers legitimate account-backed model access without
token scraping or private endpoint dependencies.

## Phase 7 - Runtime Capabilities And Options

Goal: expose runtime reality without becoming a static model encyclopedia.

- Represent tool calling modes:
  - native
  - emulated
  - unsupported
- Represent structured output modes:
  - JSON schema native
  - provider-native
  - prompt fallback
  - unsupported
- Represent reasoning controls where supported:
  - effort level
  - token/budget controls
  - provider-specific options
  - unsupported
- Keep capability profiles optional and advisory.
- Let provider discovery/runtime responses override static defaults.

Deliverable: apps can adapt their workflows to the selected provider/model
without Dockline pretending all runtimes are equivalent.

## Phase 8 - Ecosystem Adapters

Goal: make Dockline easy to adopt from existing agent stacks.

- Maintain adapters for:
  - LangChain/LangGraph JS
  - Vercel AI SDK
  - DeepAgents JS
  - Mastra/VoltAgent later
- Add examples for Yagr and n8n-as-code.
- Consider an optional local OpenAI-compatible server only after resolver/auth
  semantics are stable.

Deliverable: Dockline becomes the provider-picker and connector-resolution layer
that agent frameworks can embed instead of rebuilding.

## Immediate Tickets

1. Connect `@dockline/catalog` entries to executable AI SDK provider factories.
2. Add install/config docs generated from catalog and resolver entries.
3. Add Vercel AI Gateway as an explicit gateway provider.
4. Add smoke-test scripts that install from npm outside the monorepo.
5. Prepare `0.1.0-alpha.2` with `@dockline/catalog` and `@dockline/resolver`.

## Current Focus

Next autonomous batch:

- AI SDK executable backing for a small provider slice.
- Resolver install diagnostics.
- Gateway clarification docs and Vercel AI Gateway package/factory.
