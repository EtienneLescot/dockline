# Dockline Product Spec

Working name: **Dockline**

Positioning: **the model connector layer for JS/TS agents**.

Dockline is a provider and model connector layer for JavaScript and TypeScript
agentic applications. It gives apps a reusable way to expose a broad provider
choice to their users, connect through provider-supported auth modes, and then
surface the selected model/runtime capabilities without becoming an agent
framework itself.

## Product Experience

The primary user experience is for application developers.

A developer should be able to connect Dockline once to an agentic application,
then offer their own users a provider picker with recognized providers such as:

- OpenAI
- Google Gemini
- Anthropic
- DeepSeek
- Moonshot AI
- MiniMax
- Alibaba/Qwen
- Mistral
- OpenRouter
- local or self-hosted OpenAI-compatible endpoints
- gateway-backed providers such as Vercel AI Gateway or LiteLLM

For each major provider, Dockline should support the provider's normal API-key
path and, when officially available, account-backed auth such as OAuth, PKCE,
device code, environment-provided auth, or official SDK delegation.

After the user chooses a provider and model, Dockline should expose runtime
capabilities such as streaming, tool use, reasoning controls, structured output,
vision, files, context limits, and token usage. The application can then decide
which workflows are available for that model choice.

## Problem

JS/TS agentic applications repeatedly reimplement provider glue:

- provider lists and configuration formats
- API key and delegated authentication
- streaming normalization
- tool calling formats
- structured outputs
- OpenAI-compatible endpoints and gateways
- Codex, Copilot, VS Code LM, and other environment-backed sources
- runtime capability reporting
- provider/model selection UX
- official provider auth flows beyond API keys

This creates duplicated work, incomplete integrations, inconsistent UX, continuous maintenance, and overdependence on single gateways.

## Product Hypothesis

The ecosystem needs an open source JS/TS library that acts as the reusable
provider connection layer between agents and model sources. The library should
make it easy for applications to expose provider choice, auth choice, and model
capability-aware routing without rewriting provider glue.

Dockline should be usable by:

- CLI agents
- IDE extensions
- agent frameworks
- workflow orchestrators
- SaaS products
- local developer tools

## Non-Goals

Dockline is not:

- a full agent framework
- a LangChain clone
- a LiteLLM clone
- a Python gateway
- a SaaS platform
- a GUI
- an exhaustive model database
- a continuously maintained LLM capability catalog
- a token scraper
- an abstraction that claims all providers have identical behavior

## Core Principle

Dockline is provider-first and capability-aware, not provider-flat.

Providers connect users to models/runtimes through supported auth modes. The
selected model or runtime then exposes what it can actually do:

- text generation
- streaming
- tool calling
- structured output
- reasoning
- reasoning effort/control when supported
- vision
- files
- prompt caching
- embeddings
- image generation
- computer use
- local execution
- coding agent runtime

When a capability is missing, callers should see that directly and fail with
clear normalized errors when they request unsupported behavior.

Dockline should define the capability vocabulary and expose effective runtime
capabilities. It should not become the canonical market-wide database of every
model capability. Provider packages may ship conservative defaults and discovery
helpers, but provider docs, runtime responses, and host-app overrides remain the
source of truth.

## Initial Architecture

Initial package set:

- `@dockline/core`
- `@dockline/openai-compatible`
- `@dockline/openrouter`
- `@dockline/ai-sdk`
- `@dockline/langchain`
- `@dockline/deepagents`

Future package set:

- `@dockline/openai`
- `@dockline/anthropic`
- `@dockline/google`
- `@dockline/deepseek`
- `@dockline/moonshot`
- `@dockline/minimax`
- `@dockline/alibaba`
- `@dockline/mistral`
- `@dockline/codex`
- `@dockline/github-copilot`
- `@dockline/vscode-lm`

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
- Together
- Fireworks

OpenAI-compatible:

- custom endpoints
- local gateways
- LiteLLM proxy
- Ollama-compatible endpoints
- LM Studio
- vLLM

Gateways:

- OpenRouter
- Vercel AI Gateway
- LiteLLM proxy

Provider aggregation strategy:

- Use adapters over Vercel AI SDK, LangChain, or other maintained provider
  libraries for long-tail API-key providers when that gives broad reliable
  coverage.
- Build native Dockline provider packages when a major provider is missing,
  under-supported, or needs behavior/auth flows not exposed by upstream adapter
  libraries.
- Keep API-key provider coverage separate from account-backed auth coverage so
  the simple path stays simple.
- Keep an internal provider routing map that can route `openai`, `google`,
  `anthropic`, `mistral`, `openrouter`, `openai-compatible`, `minimax`,
  `deepseek`, `moonshot`, `alibaba`, and account-backed variants to the best
  backing implementation without exposing that complexity to integrators.

Subscription-backed connectors:

- ChatGPT/Codex when official flows exist
- GitHub Copilot via documented flow or SDK
- VS Code LM API from the extension host environment

Official account auth:

- OAuth/PKCE where the provider documents it
- device code where the provider documents it
- SDK-delegated auth where that is the official integration path
- environment-provided auth for IDEs, CLIs, or managed runtimes

Strict boundary: no token scraping, no private undocumented endpoints, and no
ToS workarounds.

End-user selection flow:

1. choose provider
2. choose connection type, such as API key, OAuth, device flow, or environment auth
3. test connection
4. choose model from discovery when available
5. choose runtime options such as reasoning effort when supported
6. run the agentic workflow with capabilities exposed by the selected runtime

Agent runtimes:

- OpenAI Codex SDK
- GitHub Copilot SDK
- CLI coding agents
- workspace-aware runtimes

## MVP Success Criteria

The MVP is successful if:

- a JS/TS app can change model sources without rewriting agent logic
- a JS/TS app can expose a provider/model picker backed by Dockline provider metadata
- OpenAI-compatible and OpenRouter support model discovery and connection checks
- OpenRouter and OpenAI-compatible endpoints work cleanly
- capabilities are visible and reliable
- streaming is normalized
- the core can later support Codex/Copilot without API breakage
- documentation clearly says what Dockline does and does not do
