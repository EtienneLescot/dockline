# Connector And Provider Matrix

This matrix tracks what Dockline can connect today, what the current packages
implement, and what is only planned. It is intentionally conservative for the
`0.1.0-alpha.0` line: a provider, auth mode, or capability is marked implemented
only when there is code in this repository for it.

This is not an exhaustive model capability catalog. The product goal is to help
applications expose provider choice and official auth paths, then surface the
runtime capabilities of the selected model or runtime.

## Status Legend

- Implemented: package or API exists in this repo.
- Adapter: integrates Dockline models with another framework, but is not a
  provider by itself.
- Planned: design direction is known, but no connector implementation exists
  yet.
- Not planned: outside the current package boundary.

## Current Packages

| Package | Status | Role | Provider picker support | Model discovery | Connection test | Auth shape | Runtime capability reporting | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@dockline/core` | Implemented | Public contracts, provider registry, discovery hooks, capability flags, normalized errors, memory/filesystem token stores, and experimental coding-agent runtime types. | Contract only | Contract only | Contract only | API key, OAuth/device-code shapes, and `TokenStore` interfaces only | Contract only | Core does not call providers directly. Coding-agent runtime types are alpha and exported through `@dockline/core/experimental`. |
| `@dockline/openai-compatible` | Implemented | Generic OpenAI-compatible chat completions connector. | Basic installed-provider metadata through package registration; richer provider-picker metadata still planned. | Yes, via `GET /models`. | Yes, via provider `testConnection()`. | API key plus custom headers. | Broad connector defaults with runtime/config overrides. | OpenAI-compatible endpoints vary by server and model; runtime errors remain authoritative. |
| `@dockline/openrouter` | Implemented | OpenRouter connector built on `@dockline/openai-compatible`. | Basic installed-provider metadata through package registration; richer provider-picker metadata still planned. | Yes, via OpenRouter `/models`. | Yes, via OpenRouter `/models`. | API key, optional app metadata headers. | Inherited OpenAI-compatible request-path defaults; selected routed model can differ. | Treat model-specific support as runtime/provider dependent. |
| `@dockline/langchain` | Adapter | LangChain JS adapter for `UniversalChatModel`. | Not a provider. | Delegates to wrapped model/provider. | Delegates to wrapped model/provider. | Uses wrapped model auth. | Delegates to wrapped model and translates messages/events. | This package is not a provider and does not add capabilities beyond the wrapped Dockline model. |

## Target Provider Coverage

Dockline should help applications expose a broad recognized provider list. The
long-tail API-key path can be delegated to maintained upstream libraries, while
native Dockline packages should fill major gaps and official auth modes.

| Provider area | API-key path | Official OAuth/device-code/account path | Intended strategy |
| --- | --- | --- | --- |
| OpenAI | Planned native package or broad provider adapter. | Planned only through official documented flows. | Native package likely needed for first-class auth/runtime behavior. |
| Google Gemini | Planned native package or broad provider adapter. | Planned only through official documented flows. | Start with API-key support, then official account auth if suitable for agent apps. |
| Anthropic | Planned native package or broad provider adapter. | Planned only through official documented flows. | API-key support can likely come from adapter; native package if auth/runtime gaps appear. |
| DeepSeek | Implemented as an OpenAI-compatible preset in `@dockline/providers`. | Unknown/planned only if officially documented. | Native only if provider-specific behavior exceeds the generic transport. |
| Moonshot AI | Implemented as an OpenAI-compatible preset in `@dockline/providers`. | Unknown/planned only if officially documented. | Native only if auth/runtime behavior requires it. |
| MiniMax | Implemented as an OpenAI-compatible preset in `@dockline/providers`. | Token Plan/account behavior remains planned only if officially documented. | Native if Token Plan, Anthropic-compatible behavior, or interleaved-thinking semantics need separate handling. |
| Alibaba/Qwen | Implemented as an OpenAI-compatible preset in `@dockline/providers`. | Unknown/planned only if officially documented. | Native only as a focused Qwen/DashScope connector, not as a general cloud SDK. |
| OpenRouter | Implemented. | API-key focused today. | Keep as gateway/provider aggregator. |
| OpenAI-compatible local/self-hosted | Implemented. | Depends on endpoint. | Keep generic and configurable. |

## Alpha Default Capability Profiles

The rows below are documentation defaults for the `0.1.0-alpha.0` package
behavior. They are not complete model catalogs and do not guarantee that a
specific model, routed provider, deployment, or account entitlement supports a
feature. Runtime config overrides and provider errors remain authoritative.

| Profile | Applies to | Default capabilities | Modes | Override guidance |
| --- | --- | --- | --- | --- |
| `openai-compatible` | `@dockline/openai-compatible` model instances when config does not override capabilities. | `textGeneration`, `streaming`, `toolCalling`, `structuredOutput`, and `vision` default to `true`; all other `ModelCapabilities` flags remain false/unknown after expansion. | `toolCallingMode: native`; `structuredOutputMode: json-schema`. | Override per endpoint/model when a server lacks tools, JSON schema, image input, or streaming, or when it offers extra features not represented by the default. |
| `openrouter` | `@dockline/openrouter` model instances, via the inherited OpenAI-compatible connector path. | Same broad defaults as `openai-compatible`: `textGeneration`, `streaming`, `toolCalling`, `structuredOutput`, and `vision` default to `true`; routed model support can differ. | `toolCallingMode: native`; `structuredOutputMode: json-schema`. | Treat as provider-level request-shape guidance only. Add model-specific overlays later only with maintainable OpenRouter/model source data. |
| `langchain` | Documentation-only adapter profile for `@dockline/langchain`. | No independent capability claims. Use the wrapped Dockline model's capabilities and profile. | No independent mode claims. Tool binding and response format are passed through to the wrapped model. | Do not use this as provider truth. It exists only to describe adapter behavior and translation boundaries. |

OpenAI exposes reasoning-effort runtime metadata for the documented effort
values on reasoning models. The OpenAI-compatible presets in
`@dockline/providers` expose only provider-documented request controls:
DeepSeek `thinking.type` and `reasoning_effort`, Moonshot/Kimi
`thinking.type`, MiniMax `reasoning_split`, and Alibaba/Qwen
`enable_thinking`. These remain provider-level request hints, not model-level
guarantees.

If these defaults become exported constants, place them in package-local
`src/capability-profiles.ts` files for the owning packages. Keep shared types
and merge helpers in `@dockline/core`, but keep provider-owned profile data out
of core unless a dedicated registry/catalog package is introduced.

## Planned Sensitive Connectors

Sensitive connectors are connectors that may involve user accounts, subscription
entitlements, local workspace access, OAuth/device-code flows, or provider terms
that require extra care. These remain planned until implemented through
documented, legal provider flows.

| Connector area | Status | Intended package shape | Capability target | Current boundary |
| --- | --- | --- | --- | --- |
| GitHub Copilot | Planned investigation | Separate connector package if supported by documented flows or official SDKs | Chat/model access or coding-agent runtime, depending on official surface | No implementation. No token scraping, private endpoints, or undocumented auth flows. |
| Codex/OpenAI subscription-backed agent support | Planned investigation | Separate connector/runtime package if official flows support it | Coding-agent runtime, not a plain universal chat model unless the official surface is actually chat-model shaped | No implementation. Keep separate from `UniversalChatModel` until behavior and auth are explicit. |
| OAuth/device-code account connectors | Planned foundation | Provider-specific packages using core `TokenStore` abstractions | Legal account-backed provider access | Core now ships memory and filesystem token stores. Keychain stores, login CLI, and provider auth flows are not implemented. |
| Local workspace-aware coding agents | Planned | Runtime adapter packages, separate from chat model providers | `CodingAgentRuntime` with workspace/file/command events | Only experimental core types exist. No runtime adapter is implemented. |

## Alpha Notes

- Dockline documents alpha default capability profiles for implemented
  connectors and adapters, but does not currently ship provider/model-specific
  profile registries or generated model catalogs.
- Consumers should still check declared capabilities and expect
  provider-specific failures for unsupported model features.
- `provider.listModels()` and `provider.testConnection()` are implemented for
  OpenAI-compatible and OpenRouter.
- Tool calling modes and structured output modes exist in core types, but richer
  provider-specific reporting is still planned.
- Connector-sensitive code should stay in separate packages so ordinary API-key
  chat connectors do not inherit account or workspace risk.
