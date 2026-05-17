# Dockline Product Spec

Working name: **Dockline**

Positioning: **the model connector layer for JS/TS agents**.

Dockline is a capability-aware model connector layer for JavaScript and TypeScript agentic applications. It gives apps a reusable way to connect to models, gateways, subscription-backed sources, and coding agent runtimes without becoming an agent framework itself.

## Problem

JS/TS agentic applications repeatedly reimplement provider glue:

- provider lists and configuration formats
- API key and delegated authentication
- streaming normalization
- tool calling formats
- structured outputs
- OpenAI-compatible endpoints and gateways
- Codex, Copilot, VS Code LM, and other environment-backed sources
- model capability mapping

This creates duplicated work, incomplete integrations, inconsistent UX, continuous maintenance, and overdependence on single gateways.

## Product Hypothesis

The ecosystem needs an open source JS/TS library that acts as the universal connector layer between agents and model sources.

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
- a token scraper
- an abstraction that claims all providers have identical behavior

## Core Principle

Dockline is capability-aware, not provider-flat.

Models and runtimes expose what they can actually do:

- text generation
- streaming
- tool calling
- structured output
- reasoning
- vision
- files
- prompt caching
- embeddings
- image generation
- computer use
- local execution
- coding agent runtime

When a capability is missing, callers should see that directly and fail with clear normalized errors when they request unsupported behavior.

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

Subscription-backed connectors:

- ChatGPT/Codex when official flows exist
- GitHub Copilot via documented flow or SDK
- VS Code LM API from the extension host environment

Agent runtimes:

- OpenAI Codex SDK
- GitHub Copilot SDK
- CLI coding agents
- workspace-aware runtimes

## MVP Success Criteria

The MVP is successful if:

- a JS/TS app can change model sources without rewriting agent logic
- OpenRouter and OpenAI-compatible endpoints work cleanly
- capabilities are visible and reliable
- streaming is normalized
- the core can later support Codex/Copilot without API breakage
- documentation clearly says what Dockline does and does not do

