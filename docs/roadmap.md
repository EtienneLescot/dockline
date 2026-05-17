# Dockline Roadmap

This roadmap keeps Dockline focused on its wedge: a capability-aware connector layer for JS/TS agents, not another agent framework.

Only remaining or active work is listed here. Completed items are removed from the main checklist once they land.

## Phase 1 - MVP Wedge

Goal: prove immediate usefulness with a small provider-choice surface area.

- Publish `0.1.0-alpha.0` to npm.

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

- Decided - Start broad API-key coverage with LangChain-backed provider
  packages for OpenAI, Anthropic, Google Gemini, and Mistral; keep Vercel AI SDK
  as a secondary backing or ecosystem adapter.
- Add LangChain-backed provider packages:
  - OpenAI
  - Google Gemini
  - Anthropic
  - Mistral
- Add native provider packages where major providers are missing or
  under-supported:
  - DeepSeek
  - Moonshot AI
  - MiniMax
  - Alibaba/Qwen
- Keep OpenRouter and OpenAI-compatible as gateway and custom endpoint paths.
- Improve normalized errors for provider-specific failures as new providers land.

Deliverable: a developer can expose a broad recognized provider list without
Dockline becoming a giant handwritten provider zoo.

## Phase 4 - Official Auth And TokenStore

Goal: support API keys and official account-backed auth paths cleanly.

- Implement built-in `TokenStore` variants:
  - memory
  - filesystem
  - optional OS keychain later
- Define OAuth/PKCE and device-code abstractions.
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

1. Decide whether to publish `0.1.0-alpha.0` now.
2. Start LangChain-backed OpenAI provider using `@dockline/langchain-provider`.
3. Start LangChain-backed Anthropic provider using `@dockline/langchain-provider`.
4. Add LangChain-backed Google and Mistral providers.
5. Expand runtime option metadata for reasoning controls once a concrete
   provider supports them.

## Current Focus

Next autonomous batch:

- LangChain-backed OpenAI provider.
- LangChain-backed Anthropic provider.
- Runtime reasoning option metadata where supported.
