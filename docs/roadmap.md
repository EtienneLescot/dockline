# Dockline Roadmap

This roadmap keeps Dockline focused on its wedge: a capability-aware connector layer for JS/TS agents, not another agent framework.

## Phase 0 - Stabilize Core

Goal: make the minimal public API credible.

- Lock down the first public types:
  - `UniversalChatModel`
  - `ModelEvent`
  - `ModelCapabilities`
  - normalized errors
  - provider registry
- Add focused tests for:
  - provider registration
  - config validation
  - streaming events
  - tool calls
  - normalized provider errors
- Document what is stable vs experimental.
- Add a small provider capability matrix.
- Add a complete minimal CLI example.

Deliverable: `@dockline/core` is clean, typed, tested, and honest about its boundaries.

## Phase 1 - MVP Wedge

Goal: prove immediate usefulness with a small surface area.

- Harden `@dockline/openai-compatible`.
- Finalize `@dockline/openrouter`.
- Add one framework adapter first:
  - LangChain/LangGraph JS, or
  - DeepAgents JS
- Add examples for:
  - OpenRouter
  - local OpenAI-compatible endpoint
  - simple agent/workflow caller
- Publish `0.1.0-alpha.0` to npm.

Deliverable: a JS/TS app can switch between OpenRouter and a local endpoint without rewriting its agent logic.

## Phase 2 - Provider Reality

Goal: expose real behavior instead of flattening providers into a fake universal model.

- Add capability profiles by provider/model where maintainable.
- Add `provider.testConnection()`.
- Add `provider.listModels()` where reasonable.
- Represent tool calling modes explicitly:
  - native
  - emulated
  - unsupported
- Represent structured output modes explicitly:
  - JSON schema native
  - provider-native
  - prompt fallback
  - unsupported
- Improve normalized errors for common provider failures.

Deliverable: Dockline is reliable enough for agents to make routing decisions from capabilities.

## Phase 3 - Auth And TokenStore

Goal: prepare subscription-backed connectors without muddy shortcuts.

- Implement built-in `TokenStore` variants:
  - memory
  - filesystem
  - optional OS keychain later
- Define OAuth/device-code abstractions.
- Add a small CLI:
  - `dockline login`
  - `dockline logout`
  - `dockline status`
- Document security rules:
  - never log secrets
  - never scrape tokens
  - never depend on private undocumented endpoints
  - keep connector-sensitive code in separate packages

Deliverable: Dockline has clean auth primitives for legal, documented provider flows.

## Phase 4 - Differentiation

Goal: support model sources that are not just API-key chat models.

- Investigate GitHub Copilot support through documented flows or official SDKs.
- Investigate Codex/OpenAI subscription-backed support only through official flows.
- Keep `CodingAgentRuntime` separate from `UniversalChatModel`.
- Add runtime adapters for workspace-aware coding agents when robust.

Deliverable: Dockline can represent agent runtimes without pretending they are ordinary chat models.

## Phase 5 - Ecosystem

Goal: make Dockline easy to adopt from existing JS/TS agent stacks.

- Add adapters:
  - LangChain/LangGraph JS
  - DeepAgents JS
  - Vercel AI SDK
  - Mastra/VoltAgent later
- Add optional local OpenAI-compatible server.
- Publish and maintain a provider matrix.
- Add examples for Yagr and n8n-as-code.

Deliverable: Dockline becomes reusable glue across agent frameworks, CLIs, IDE extensions, and workflow tools.

## Immediate Tickets

1. Done - Add contract tests for OpenAI-compatible streaming.
2. Tighten the public core API and mark the alpha boundary.
3. Add a LangChain JS adapter.
4. Improve the README quickstart.
5. Prepare npm package metadata for `0.1.0-alpha.0`.

## Current Focus

Start with OpenAI-compatible contract tests. This catches the most fragile part of the MVP first: converting provider streams into stable Dockline events.
