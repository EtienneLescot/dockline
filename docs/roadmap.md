# Dockline Roadmap

This roadmap keeps Dockline focused on its wedge: a capability-aware connector layer for JS/TS agents, not another agent framework.

Only remaining or active work is listed here. Completed items are removed from the main checklist once they land.

## Phase 1 - MVP Wedge

Goal: prove immediate usefulness with a small provider-choice surface area.

- Keep npm release hygiene for future alpha cuts:
  - version packages together
  - publish in dependency order
  - smoke-test installs outside the monorepo
  - keep `alpha` and `latest` dist-tags aligned intentionally

Deliverable: a JS/TS app can switch between OpenRouter and a local endpoint
without rewriting its agent logic.

## Phase 2 - Provider Picker Foundation

Goal: make Dockline useful for applications that want to expose provider choice
to end users.

Deliverable: an app can build a provider picker from Dockline-installed
connectors without hardcoding every provider manually.

## Phase 3 - Provider Coverage

Goal: cover major providers broadly without rewriting every API-key connector by
hand.

- Keep OpenRouter and OpenAI-compatible as gateway and custom endpoint paths.
- Add native provider packages only where provider-specific behavior requires
  it beyond the current OpenAI-compatible presets.
- Improve normalized errors for provider-specific failures as new providers land.

Deliverable: a developer can expose a broad recognized provider list without
Dockline becoming a giant handwritten provider zoo.

## Phase 4 - Official Auth And TokenStore

Goal: support API keys and official account-backed auth paths cleanly.

- Add an optional OS keychain `TokenStore` later.
- Keep OAuth/PKCE and device-code alpha contracts provider-neutral until
  official-auth connectors prove the shape.
- Add a small CLI:
  - `dockline login`
  - `dockline logout`
  - `dockline status`
- Add official-auth connectors only where provider flows are documented:
  - OAuth/PKCE
  - device code
  - SDK-delegated auth
  - environment-provided auth
- Document security rules:
  - never log secrets
  - never scrape tokens
  - never depend on private undocumented endpoints
  - keep connector-sensitive code in separate packages

Deliverable: Dockline has clean auth primitives for legal, documented provider flows.

## Phase 5 - Runtime Capability Reality

Goal: expose real runtime behavior instead of flattening providers into a fake
universal model.

- Represent tool calling modes explicitly:
  - native
  - emulated
  - unsupported
- Represent structured output modes explicitly:
  - JSON schema native
  - provider-native
  - prompt fallback
  - unsupported
- Represent reasoning controls where supported:
  - effort level
  - budget/tokens when provider-supported
  - unsupported
- Keep capability profiles optional and advisory.
- Do not maintain an exhaustive model capability database in core.

Deliverable: agents and UIs can adapt to the model selected by the user at
runtime without Dockline pretending all models are equivalent.

## Phase 6 - Agent Runtime Differentiation

Goal: support model sources that are not just API-key chat models.

- Investigate GitHub Copilot support through documented flows or official SDKs.
- Investigate Codex/OpenAI subscription-backed support only through official flows.
- Keep `CodingAgentRuntime` separate from `UniversalChatModel`.
- Add runtime adapters for workspace-aware coding agents when robust.

Deliverable: Dockline can represent agent runtimes without pretending they are ordinary chat models.

## Phase 7 - Ecosystem

Goal: make Dockline easy to adopt from existing JS/TS agent stacks.

- Add adapters:
  - LangChain/LangGraph JS
  - DeepAgents JS
  - Vercel AI SDK
  - Mastra/VoltAgent later
- Add optional local OpenAI-compatible server.
- Publish and maintain a connector/provider matrix, not an exhaustive model
  capability catalog.
- Add examples for Yagr and n8n-as-code.

Deliverable: Dockline becomes reusable glue across agent frameworks, CLIs, IDE extensions, and workflow tools.

## Immediate Tickets

1. Add a smoke-test example or script that installs Dockline from npm outside
   the monorepo.
2. Continue expanding runtime option metadata for reasoning controls only where
   provider documentation exposes concrete request parameters.
3. Add provider-specific error normalization for the OpenAI-compatible presets
   as real API failures are observed.
4. Connect `@dockline/catalog` entries to executable AI SDK, LangChain, gateway,
   and Dockline-native backings.
5. Write per-provider usage docs for the current provider list.

## Current Focus

Next autonomous batch:

- npm smoke-test script and release hygiene docs.
- Provider catalog backing resolver.
- Provider-specific docs for install/config/auth/runtime options.
