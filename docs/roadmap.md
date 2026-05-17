# Dockline Roadmap

This roadmap keeps Dockline focused on its wedge: a capability-aware connector layer for JS/TS agents, not another agent framework.

Only remaining or active work is listed here. Completed items are removed from the main checklist once they land.

## Phase 1 - MVP Wedge

Goal: prove immediate usefulness with a small surface area.

- Publish `0.1.0-alpha.0` to npm.

Deliverable: a JS/TS app can switch between OpenRouter and a local endpoint without rewriting its agent logic.

## Phase 2 - Provider Reality

Goal: expose real behavior instead of flattening providers into a fake universal model.

- Add code-backed capability profile constants where maintainable.
- Represent tool calling modes explicitly:
  - native
  - emulated
  - unsupported
- Represent structured output modes explicitly:
  - JSON schema native
  - provider-native
  - prompt fallback
  - unsupported
- Improve normalized errors for additional provider-specific failures.

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

1. Decide whether to publish `0.1.0-alpha.0` now.
2. Add code-backed capability profile constants for current package defaults.
3. Improve normalized error mapping for additional provider-specific failures.
4. Decide whether Phase 2 discovery hooks need provider-specific docs examples.

## Current Focus

Next decision:

- Publish `0.1.0-alpha.0` now, or do one small code-backed profile pass first.
