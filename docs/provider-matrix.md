# Provider Capability Matrix

This matrix tracks what Dockline can represent today, what the current packages
implement, and what is only planned. It is intentionally conservative for the
`0.1.0-alpha.0` line: a capability is marked implemented only when there is code
in this repository for it.

## Status Legend

- Implemented: package or API exists in this repo.
- Adapter: integrates Dockline models with another framework, but is not a
  provider by itself.
- Planned: design direction is known, but no connector implementation exists
  yet.
- Not planned: outside the current package boundary.

## Current Packages

| Package | Status | Role | Text generation | Streaming | Tool calling | Structured output | Vision input | Token usage | Auth shape | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@dockline/core` | Implemented | Public contracts, capability flags, provider registry, normalized errors, token-store primitives, and experimental coding-agent runtime types. | Contract only | Contract only | Contract only | Contract only | Contract only | Contract only | API key, OAuth/device-code shapes, and `TokenStore` interfaces only | Core does not call providers directly. Coding-agent runtime types are alpha and exported through `@dockline/core/experimental`. |
| `@dockline/openai-compatible` | Implemented | OpenAI-compatible chat completions connector. | Yes | Yes, via server-sent events | Native function/tool calls | JSON object and JSON schema request mapping | URL image parts are mapped; file parts are rejected | Maps OpenAI-style usage fields | API key plus custom headers | Capability defaults are broad and can be overridden per config/provider because OpenAI-compatible endpoints vary by model and server. |
| `@dockline/openrouter` | Implemented | OpenRouter connector built on `@dockline/openai-compatible`. | Yes | Yes | Native where the selected OpenRouter model/provider supports it | JSON object/schema request mapping through the OpenAI-compatible connector | Inherited from OpenAI-compatible path; actual support depends on routed model | Yes when returned by OpenRouter/model | API key, optional app metadata headers | No model-listing or provider/model capability profile is implemented yet. Treat model-specific support as runtime/provider dependent. |
| `@dockline/langchain` | Adapter | LangChain JS adapter for `UniversalChatModel`. | Delegates to wrapped model | Delegates to wrapped model | Accepts/binds tools and delegates to wrapped model | Delegates response format to wrapped model | Converts LangChain-style image URL parts to Dockline image parts | Maps Dockline usage to LangChain-style metadata | Uses wrapped model auth | This package is not a provider and does not add capabilities beyond the wrapped Dockline model. |

## Planned Sensitive Connectors

Sensitive connectors are connectors that may involve user accounts, subscription
entitlements, local workspace access, OAuth/device-code flows, or provider terms
that require extra care. These remain planned until implemented through
documented, legal provider flows.

| Connector area | Status | Intended package shape | Capability target | Current boundary |
| --- | --- | --- | --- | --- |
| GitHub Copilot | Planned investigation | Separate connector package if supported by documented flows or official SDKs | Chat/model access or coding-agent runtime, depending on official surface | No implementation. No token scraping, private endpoints, or undocumented auth flows. |
| Codex/OpenAI subscription-backed agent support | Planned investigation | Separate connector/runtime package if official flows support it | Coding-agent runtime, not a plain universal chat model unless the official surface is actually chat-model shaped | No implementation. Keep separate from `UniversalChatModel` until behavior and auth are explicit. |
| OAuth/device-code account connectors | Planned foundation | Provider-specific packages using core `TokenStore` abstractions | Legal account-backed provider access | Core only defines token primitives today; built-in filesystem/keychain stores and login CLI are not implemented. |
| Local workspace-aware coding agents | Planned | Runtime adapter packages, separate from chat model providers | `CodingAgentRuntime` with workspace/file/command events | Only experimental core types exist. No runtime adapter is implemented. |

## Alpha Notes

- Dockline does not currently maintain provider/model-specific capability
  profiles. Consumers should still check declared capabilities and expect
  provider-specific failures for unsupported model features.
- `provider.listModels()` and `provider.testConnection()` are roadmap items, not
  implemented behavior.
- Tool calling modes and structured output modes exist in core types, but richer
  provider-specific reporting is still planned.
- Connector-sensitive code should stay in separate packages so ordinary API-key
  chat connectors do not inherit account or workspace risk.
