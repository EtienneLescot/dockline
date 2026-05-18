# Provider Catalog

Dockline's provider catalog is the user-facing list an integrator can expose in
a provider picker. It is not the same thing as the list of provider packages
Dockline has implemented by hand.

## Definition

A provider is the party that supplies model access through an API key, OAuth
flow, device-code flow, environment credential, local runtime, or gateway
account.

Examples:

- OpenAI is a provider.
- Anthropic is a provider.
- OpenRouter is a provider because the user brings an OpenRouter API key.
- Vercel AI Gateway is a provider because the user authenticates with Vercel AI
  Gateway, even if requests are routed to upstream models.
- Vercel AI SDK is not a provider. It is an upstream JS/TS adapter library.
- LangChain is not a provider. It is an upstream JS/TS adapter library.
- Dockline is not a gateway SaaS. It is the code-side aggregator.

## Calculation Method

The catalog is computed pragmatically:

1. Use Vercel AI SDK providers as the primary upstream directory, because its
   provider contract maps well to Dockline's JS/TS connector resolver.
2. Add LangChain JS chat-model providers that are missing from the AI SDK
   directory.
3. Add Dockline-native account-backed providers that neither upstream directory
   solves cleanly, especially OpenAI ChatGPT account access and GitHub Copilot
   device flow.

The result is a deduplicated list with stable Dockline ids. Each entry records:

- `sources`: where the catalog entry came from (`ai-sdk`, `langchain`, or
  `dockline-native`);
- `providerKind`: API provider, gateway, local runtime, account-backed provider,
  agent runtime, protocol, or observability layer;
- `authModes`: API key, OAuth, device code, environment, or custom;
- `recommendedBacking`: the preferred implementation path for Dockline;
- `availableBackings`: known possible implementation paths.

## Gateways

Gateways are first-class providers in Dockline. They are not neutral directories.

Examples:

- `openrouter`
- `vercel-ai-gateway`
- `portkey`
- `requesty`
- `langdb`
- `openai-compatible`

If a user selects OpenRouter, they bring an OpenRouter key. If a user selects
Vercel AI Gateway, they bring Vercel Gateway credentials. Dockline may use those
gateways' model discovery APIs, but the gateway remains the provider selected by
the user.

## Initial Catalog Implementation

The first catalog implementation lives in `@dockline/catalog`.

```ts
import { listCatalogProviders } from "@dockline/catalog";

const providers = listCatalogProviders();
```

Filtering is available for picker UX:

```ts
const gateways = listCatalogProviders({ providerKind: "gateway" });
const deviceCodeProviders = listCatalogProviders({ authMode: "device-code" });
const docklineNative = listCatalogProviders({ source: "dockline-native" });
```

The catalog is intentionally metadata only. It does not mean every entry already
has a native Dockline package. The next implementation step is to connect these
catalog entries to executable backings.

## Current Catalog Origins

Primary AI SDK origin:

- Vercel AI Gateway
- Vercel / v0
- OpenAI
- Azure OpenAI
- Anthropic
- Amazon Bedrock
- Google Generative AI / Gemini
- Google Vertex AI
- xAI / Grok
- Mistral AI
- Together.ai
- Cohere
- Fireworks
- DeepInfra
- DeepSeek
- Cerebras
- Groq
- Perplexity
- Moonshot AI
- Alibaba / Qwen
- Hugging Face
- NVIDIA NIM
- Clarifai
- Baseten
- OpenAI-compatible endpoint
- LM Studio
- Heroku
- Ollama
- FriendliAI
- Portkey
- Cloudflare Workers AI
- OpenRouter
- Apertis
- Aihubmix
- Requesty
- Crosshatch
- Mixedbread
- Voyage AI
- Mem0
- Letta
- Hindsight
- Supermemory
- Spark
- Anthropic Vertex
- LangDB
- Dify
- Sarvam
- Claude Code
- Browser AI
- Gemini CLI
- A2A
- SAP AI Core
- AI/ML API
- MCP Sampling
- ACP
- OpenCode
- Codex CLI
- Soniox
- Zhipu / Z.AI
- OLLM
- Fal
- Black Forest Labs
- Replicate
- Prodia
- Luma AI
- ByteDance
- Kling AI
- ElevenLabs
- AssemblyAI
- Deepgram
- Gladia
- LMNT
- Hume
- Rev.ai

LangChain complement origin:

- Arcjet
- Baidu Qianfan
- Baidu Wenxin
- IBM
- Neural Internet Bittensor
- Novita
- Ollama Functions
- PremAI
- PromptLayer OpenAI
- Tencent Hunyuan
- WebLLM
- Yandex

Dockline-native origin:

- OpenAI ChatGPT account
- GitHub Copilot
- VS Code LM API

## References

- Vercel AI SDK providers:
  <https://ai-sdk.dev/providers/ai-sdk-providers>
- Vercel AI SDK provider architecture:
  <https://ai-sdk.dev/docs/foundations/providers-and-models>
- LangChain JS provider list:
  <https://docs.langchain.com/oss/javascript/integrations/providers/all_providers>
