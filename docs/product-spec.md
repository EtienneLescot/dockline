# Dockline Product Spec

Working name: **Dockline**

Positioning:

> The open provider picker and connector resolver for JS/TS agents.

Dockline helps JavaScript and TypeScript agentic applications expose model
provider choice without becoming a gateway SaaS and without reimplementing every
provider API by hand.

## Product Experience

The primary user is the application developer building an agentic product, CLI,
IDE extension, local tool, or workflow orchestrator.

That developer should be able to plug Dockline into the app and offer end users
a clean flow:

1. Choose a provider.
2. Choose an auth method supported by that provider.
3. Enter or complete credentials.
4. Test the connection.
5. Discover or enter a model.
6. Choose runtime options such as reasoning effort when supported.
7. Run the agentic workflow with the selected connector.

The provider list should include providers from Vercel AI SDK, providers from
LangChain that AI SDK does not cover, gateways such as OpenRouter and Vercel AI
Gateway, local runtimes, and Dockline-native account-backed providers such as
ChatGPT account access or GitHub Copilot when official flows exist.

## Definition Of Provider

A provider is the party that supplies model access credentials.

Examples:

- OpenAI is a provider.
- Anthropic is a provider.
- Google Gemini is a provider.
- OpenRouter is a provider/gateway because the user brings an OpenRouter key.
- Vercel AI Gateway is a provider/gateway because the user brings Vercel
  Gateway credentials.
- Ollama and LM Studio are local runtime providers.
- Vercel AI SDK is not a provider. It is an upstream adapter library.
- LangChain is not a provider. It is an upstream adapter library.
- Dockline is not a provider gateway. It is the open code-side aggregator.

## Problem

Current JS/TS agentic applications often have to stitch together:

- provider lists;
- provider display metadata;
- auth modes;
- API-key configuration forms;
- OAuth/device/environment auth flows;
- model discovery;
- connection testing;
- gateway distinctions;
- local runtime distinctions;
- reasoning/runtime options;
- streaming/tool-call compatibility;
- fallbacks between AI SDK, LangChain, OpenAI-compatible APIs, and custom code.

AI SDK and LangChain solve large parts of the transport/provider problem, but
they do not give an application a complete open provider-picker experience that
also covers gateways, account-backed auth, IDE environment APIs, and connector
resolution.

## Product Hypothesis

Dockline should be valuable even when most provider calls are delegated to
upstream libraries.

The missing layer is:

- an open, deduplicated provider catalog;
- origin metadata showing whether a provider came from AI SDK, LangChain, or
  Dockline-native gaps;
- auth-mode metadata for picker UX;
- provider-kind metadata that separates API providers, gateways, local runtimes,
  account-backed providers, protocols, and agent runtimes;
- a connector resolver that chooses the best executable backing;
- native connectors only for gaps upstream libraries do not solve cleanly.

## Scope

Dockline should provide:

- `@dockline/catalog` as the user-facing provider catalog;
- connector resolver APIs that map a catalog entry and auth choice to an
  executable backing;
- adapters to Vercel AI SDK and LangChain;
- native OpenAI-compatible and gateway connectors where useful;
- official-auth native connectors for ChatGPT/OpenAI account access, GitHub
  Copilot, VS Code LM API, Codex/runtime access, and similar cases only when
  documented flows exist;
- discovery and connection-test hooks for providers that support them;
- capability and runtime-option vocabulary for the selected runtime.

## Non-Goals

Dockline is not:

- an agent framework;
- a LangChain clone;
- a Vercel AI SDK clone;
- a LiteLLM clone;
- a Python gateway;
- a hosted SaaS gateway;
- a GUI;
- an exhaustive model capability database;
- a scraper of browser/session tokens;
- a wrapper that hides all provider differences.

## Backing Strategy

Dockline should avoid owning provider API debt when a maintained upstream
adapter is enough.

The order is:

1. Use Vercel AI SDK as the primary upstream directory and preferred backing for
   broad API-key providers.
2. Add LangChain JS chat-model providers missing from AI SDK.
3. Keep gateways as first-class providers, not as neutral directories.
4. Use Dockline's native OpenAI-compatible transport for arbitrary base URL
   endpoints and gateway-specific paths where it is already stronger.
5. Build native packages only for official auth, account-backed providers,
   environment APIs, runtime connectors, or provider behavior that upstream
   libraries do not cover robustly.

## Provider Categories

API-key providers:

- OpenAI
- Anthropic
- Google Gemini
- Mistral
- DeepSeek
- Moonshot AI
- MiniMax
- Alibaba/Qwen
- Groq
- Together.ai
- Fireworks
- Cohere
- Perplexity
- and the broader AI SDK/LangChain catalog

Gateway providers:

- OpenRouter
- Vercel AI Gateway
- Portkey
- Requesty
- LangDB
- LiteLLM/OpenAI-compatible gateways

Local/runtime providers:

- Ollama
- LM Studio
- llama.cpp
- WebLLM
- Browser AI

Account-backed providers:

- OpenAI ChatGPT account, only through official OAuth/device/headless flows if
  available for the target use case;
- GitHub Copilot, only through documented device flow or SDK delegation;
- VS Code LM API through environment-provided access;
- Codex/CLI/runtime access only through official documented APIs.

## Capabilities

Dockline should expose capabilities and runtime options for the selected model
or runtime, but it should not maintain a market-wide static model database.

Capability data can come from:

- provider discovery APIs;
- upstream provider metadata;
- conservative Dockline defaults;
- host-application overrides;
- runtime responses.

Capabilities are advisory until confirmed by the selected runtime.

## Security And Terms Boundary

Dockline must not:

- scrape tokens;
- use private undocumented endpoints;
- bypass provider terms;
- log secrets;
- store tokens unless the host application explicitly provides a token store and
  consents to the flow.

## MVP Success Criteria

The MVP is successful if:

- an app can list a broad provider catalog from Dockline without manually
  hardcoding AI SDK and LangChain provider lists;
- each catalog entry exposes source, provider kind, auth modes, and recommended
  backing;
- gateways are represented as provider choices;
- OpenRouter and OpenAI-compatible endpoints remain executable;
- at least one AI SDK-backed provider can be resolved through Dockline;
- the architecture clearly reserves native packages for ChatGPT account,
  Copilot, VS Code LM, Codex/runtime, and other official-auth gaps;
- docs clearly explain that Dockline is an open code-side aggregator, not a
  hosted gateway or provider SDK clone.
