# Provider Coverage Strategy

Dockline should cover broad API-key providers without becoming a handwritten
provider zoo. The coverage layer is an internal backing choice: integrators
should see stable Dockline provider ids, auth modes, metadata, and runtime
capabilities, not the upstream SDK chosen for a given connector.

## Recommendation

Start broad API-key coverage with LangChain JS provider packages for the first
recognized provider set:

- `anthropic` through `@langchain/anthropic`
- `openai` through `@langchain/openai`
- `google` through `@langchain/google-genai`
- `mistral` through `@langchain/mistralai`

Keep `openrouter` and `openai-compatible` on Dockline's existing
OpenAI-compatible transport with configurable base URLs. Do not route them
through LangChain or Vercel AI SDK by default.

Use native Dockline packages for providers that are missing upstream, where
upstream behavior is insufficient, or where Dockline needs official
account-backed auth, token storage, richer connection testing, provider-specific
runtime options, or legal/security boundaries that a generic API-key adapter
should not own.

Vercel AI SDK should remain a planned secondary backing and ecosystem adapter,
not the first coverage dependency. Revisit it after the LangChain-backed
provider path proves the Dockline provider contracts, or use it selectively
when it has materially better support for a provider/runtime target.

## LangChain Versus Vercel AI SDK

Both LangChain JS and Vercel AI SDK have maintained provider ecosystems covering
OpenAI, Anthropic, Google, and Mistral. The choice is not about which project can
call those APIs; it is about which backing creates the least product ambiguity
for Dockline's provider-picker goal.

| Criterion | LangChain JS | Vercel AI SDK | Dockline decision |
| --- | --- | --- | --- |
| Current target-provider fit | Direct packages exist for OpenAI, Anthropic, Google GenAI, and Mistral. | Direct packages also exist for OpenAI, Anthropic, Google GenAI, and Mistral. | Tie on named API-key coverage. |
| Existing Dockline surface | Dockline already has `@dockline/langchain` as an ecosystem adapter, making LangChain concepts familiar in the repo. | Vercel AI SDK is listed as a future ecosystem adapter, but is not the current provider path. | Prefer the existing LangChain direction first. |
| Provider-picker metadata | LangChain chat models are broad runtime objects; Dockline will still need a metadata wrapper for auth modes, discovery, connection tests, and runtime options. | AI SDK providers have a focused language-model abstraction, but Dockline still needs its own metadata wrapper for auth modes, discovery, connection tests, and official auth boundaries. | Neither removes the need for Dockline metadata. |
| Long-tail and agent ecosystem | Strong fit for LangChain/LangGraph users and broad JS agent ecosystems. | Strong fit for frontend/serverless apps using `ai` functions and Vercel provider packages. | Start with LangChain; expose Vercel AI SDK later as an adapter/backing option. |
| Bundle/runtime pressure | Provider packages and LangChain core can be heavier; keep them optional and out of `@dockline/core`. | Often attractive for web/edge/serverless surfaces, but still adds provider dependencies. | Use explicit provider packages and optional `@dockline/all` inclusion controls. |
| Official account auth | Generic API-key providers should not own OAuth/device-code/token-store behavior. | Same limitation for Dockline's purposes. | Native Dockline packages own official account auth in both cases. |

The initial coverage decision is therefore:

1. Use LangChain-backed Dockline provider packages for the first API-key
   provider set.
2. Keep OpenRouter and arbitrary OpenAI-compatible endpoints on the native
   OpenAI-compatible transport.
3. Build native Dockline packages for missing providers and official auth.
4. Add Vercel AI SDK backing only after the provider metadata, discovery, and
   runtime-option contract is stable enough to support a second backing without
   creating divergent behavior for the same provider id.

## Target Map

| Dockline provider id | First backing | Auth boundary | Native Dockline fallback |
| --- | --- | --- | --- |
| `anthropic` | LangChain API-key package | API key first; official account auth only if documented. | If LangChain lacks required runtime options, discovery, error mapping, or auth behavior. |
| `openai` | LangChain API-key package | API key first. OAuth/PKCE/device-code only through a separate official-auth package if documented for the target use case. | Likely for official auth, richer reasoning controls, connection testing, and model discovery semantics. |
| `google` | LangChain Google GenAI API-key package | Gemini API key path stays separate from Google account/cloud auth. | If account/cloud auth or model-specific runtime behavior needs Dockline-owned handling. |
| `mistral` | LangChain API-key package | API key first. | If upstream coverage misses model discovery, tools, structured output, or runtime options Dockline needs. |
| `openrouter` | Native OpenAI-compatible transport with OpenRouter base URL | API key and OpenRouter app metadata headers. | Already native as `@dockline/openrouter`. |
| `openai-compatible` | Native OpenAI-compatible transport with custom base URL | API key and custom headers. | Already native as `@dockline/openai-compatible`. |
| `deepseek` | Evaluate upstream support after the first four providers | API key first. | Build native if upstream support is weak or if provider-specific behavior matters. |
| `moonshot` | Evaluate upstream support after the first four providers | API key first; account flow only if documented. | Build native if missing upstream or auth/runtime behavior requires it. |
| `minimax` | Evaluate upstream support after the first four providers | API key first. | Build native if missing upstream or if token-plan behavior must be isolated. |
| `minimax-token-plan` | Native only if officially documented | Official token-plan/subscription flow only. | Keep separate from API-key MiniMax. |
| `alibaba` | Evaluate upstream support after the first four providers | API key/cloud credential path first. | Build native only as a focused Qwen/DashScope connector, not as a general cloud SDK. |

## Implementation Sequence

1. Define a small upstream-provider adapter contract inside the provider package
   boundary, not in `@dockline/core`. It should translate Dockline messages,
   streaming, errors, metadata, and runtime options to a backing model.
2. Implement LangChain-backed provider packages for `anthropic`, `openai`,
   `google`, and `mistral` with stable Dockline provider ids and API-key auth
   metadata.
3. Add provider-owned `testConnection()` and `listModels()` behavior where the
   upstream package exposes enough documented API surface. If not, mark the
   metadata accurately instead of faking support.
4. Normalize errors from these packages into Dockline's existing error shape,
   preserving provider-specific details under a namespaced field.
5. Add the providers to `@dockline/all` behind explicit backing controls so
   integrators can exclude LangChain dependencies.
6. Evaluate gaps after the first four providers:
   - model discovery quality;
   - streaming/tool-call parity;
   - structured output behavior;
   - reasoning/runtime option support;
   - browser, edge, serverless, and Node compatibility;
   - terms and official auth needs.
7. Build native Dockline packages for any major provider or auth mode where the
   LangChain-backed path is insufficient.
8. Add Vercel AI SDK as a second backing only when there is a clear reason:
   better provider coverage, better web/edge runtime behavior, or direct demand
   from AI SDK host applications.

## Guardrails

- `@dockline/core` must not depend on LangChain, Vercel AI SDK, or provider SDKs.
- Provider ids must remain stable even if the backing changes later.
- API-key provider packages must not include account-backed auth code.
- Official OAuth, device-code, SDK-delegated, environment-provided, and
  token-plan flows require native Dockline connectors or clearly isolated
  package entry points.
- Provider-specific runtime controls should be exposed through Dockline metadata
  and namespaced escape hatches, not by leaking a whole upstream client as the
  primary API.
- Model capabilities remain runtime/provider output, not an exhaustive static
  database in core.

## Upstream References Checked

- LangChain JS chat integration docs list API-key chat model packages for
  OpenAI, Anthropic, Google GenAI, and Mistral:
  <https://docs.langchain.com/oss/javascript/integrations/chat>
- LangChain's Anthropic JS reference shows the package-level API-key chat-model
  pattern used by the target API-key providers:
  <https://reference.langchain.com/javascript/langchain-anthropic>
- Vercel AI SDK provider docs list official providers including OpenAI,
  Anthropic, Google Generative AI, Mistral, DeepSeek, and OpenAI-compatible
  options:
  <https://ai-sdk.dev/docs/foundations/providers-and-models>
