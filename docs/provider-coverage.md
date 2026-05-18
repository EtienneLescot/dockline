# Provider Coverage Strategy

Dockline should cover broad API-key providers without becoming a handwritten
provider zoo. The coverage layer is an internal backing choice: integrators
should see stable Dockline provider ids, auth modes, metadata, and runtime
capabilities, not the upstream SDK chosen for a given connector.

## Recommendation

Start broad provider-picker coverage with a catalog, not handwritten provider
packages. `@dockline/catalog` uses Vercel AI SDK providers as the primary
directory, then adds LangChain JS chat-model providers missing from that
directory, then adds Dockline-native account-backed gaps such as ChatGPT account
auth and GitHub Copilot device flow.

Keep gateways as providers. OpenRouter and Vercel AI Gateway are not neutral
directories in Dockline's product model; they are provider choices because the
user brings an OpenRouter or Vercel Gateway credential.

Executable provider backings come after catalog metadata. A catalog entry can be
backed by Vercel AI SDK, LangChain, Dockline's OpenAI-compatible transport, a
gateway-specific connector, or a future native account-backed connector.

Use native Dockline packages for providers that are missing upstream, where
upstream behavior is insufficient, or where Dockline needs official
account-backed auth, token storage, richer connection testing, provider-specific
runtime options, or legal/security boundaries that a generic API-key adapter
should not own.

Vercel AI SDK is now a structural bridge through `@dockline/ai-sdk` and the
primary upstream directory for `@dockline/catalog`. LangChain remains the
complementary directory for providers that AI SDK does not cover.

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

The current coverage decision is therefore:

1. Use `@dockline/catalog` as the provider-picker source of truth.
2. Use Vercel AI SDK as the primary upstream directory/backing.
3. Add LangChain JS chat providers that are absent from AI SDK.
4. Treat gateways such as OpenRouter and Vercel AI Gateway as providers.
5. Build native Dockline connectors only for gaps upstream libraries do not
   solve cleanly, especially official OAuth/device/account-backed flows.

## Target Map

| Dockline provider id | First backing | Auth boundary | Native Dockline fallback |
| --- | --- | --- | --- |
| `anthropic` | LangChain API-key package | API key first; official account auth only if documented. | If LangChain lacks required runtime options, discovery, error mapping, or auth behavior. |
| `openai` | LangChain API-key package | API key first. OAuth/PKCE/device-code only through a separate official-auth package if documented for the target use case. | Likely for official auth, richer reasoning controls, connection testing, and model discovery semantics. |
| `google` | LangChain Google GenAI API-key package | Gemini API key path stays separate from Google account/cloud auth. | If account/cloud auth or model-specific runtime behavior needs Dockline-owned handling. |
| `mistral` | LangChain API-key package | API key first. | If upstream coverage misses model discovery, tools, structured output, or runtime options Dockline needs. |
| `openrouter` | Native OpenAI-compatible transport with OpenRouter base URL | API key and OpenRouter app metadata headers. | Already native as `@dockline/openrouter`. |
| `openai-compatible` | Native OpenAI-compatible transport with custom base URL | API key and custom headers. | Already native as `@dockline/openai-compatible`. |
| `deepseek` | OpenAI-compatible preset with `https://api.deepseek.com` | API key first. | Native only if provider-specific behavior exceeds the generic transport. |
| `moonshot` | OpenAI-compatible preset with `https://api.moonshot.ai/v1` | API key first; account flow only if documented. | Native only if auth/runtime behavior requires it. |
| `minimax` | OpenAI-compatible preset with `https://api.minimax.io/v1` | API key first. | Native if Token Plan, Anthropic-compatible behavior, or interleaved-thinking semantics need separate handling. |
| `minimax-token-plan` | Native only if officially documented | Official token-plan/subscription flow only. | Keep separate from API-key MiniMax. |
| `alibaba` | OpenAI-compatible preset with `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, overridable per region | API key/cloud credential path first. | Native only as a focused Qwen/DashScope connector, not as a general cloud SDK. |

## Implementation Sequence

1. Define a small upstream-provider adapter contract inside the provider package
   boundary, not in `@dockline/core`. It should translate Dockline messages,
   streaming, errors, metadata, and runtime options to a backing model.
2. Implement LangChain-backed provider packages for `anthropic`, `openai`,
   `google`, and `mistral` with stable Dockline provider ids and API-key auth
   metadata.
3. Add OpenAI-compatible presets for DeepSeek, Moonshot/Kimi, MiniMax, and
   Alibaba/Qwen before adding new backings.
4. Add provider-owned `testConnection()` and `listModels()` behavior where the
   upstream package exposes enough documented API surface. If not, mark the
   metadata accurately instead of faking support.
5. Normalize errors from these packages into Dockline's existing error shape,
   preserving provider-specific details under a namespaced field.
6. Add the providers to `@dockline/all` behind explicit backing controls so
   integrators can exclude LangChain dependencies.
7. Evaluate gaps after the first provider waves:
   - model discovery quality;
   - streaming/tool-call parity;
   - structured output behavior;
   - reasoning/runtime option support;
   - browser, edge, serverless, and Node compatibility;
   - terms and official auth needs.
8. Build native Dockline packages for any major provider or auth mode where the
   LangChain-backed path is insufficient.
9. Add Vercel AI SDK as a second backing only when there is a clear reason:
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
