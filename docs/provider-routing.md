# Provider Routing Plan

Dockline should present one provider/model/auth surface to integrators while
using the best available backing implementation internally.

The integrator should not need to know whether a provider is implemented through
LangChain, Vercel AI SDK, OpenAI-compatible transport, or a native Dockline
connector. That routing decision belongs inside Dockline.

## Internal Provider Map

Initial target map:

| Dockline provider id | Preferred backing implementation | Auth modes target | Notes |
| --- | --- | --- | --- |
| `anthropic` | `@langchain/anthropic` or Vercel AI SDK provider | API key first; official account auth only if documented | Use upstream maintained API-key support unless Dockline needs auth/runtime behavior not exposed upstream. |
| `openai` | `@langchain/openai` or Vercel AI SDK provider | API key; OAuth/PKCE/device flow only through official documented flows | Native Dockline package may be needed for first-class official account auth and reasoning/runtime options. |
| `google` | `@langchain/google-genai` or Vercel AI SDK provider | API key first; official Google auth only if appropriate and documented for this use case | Keep Gemini API key path separate from any Google account flow. |
| `mistral` | `@langchain/mistralai` or Vercel AI SDK provider | API key first | Native Dockline package only if upstream coverage is insufficient. |
| `openrouter` | OpenAI-compatible transport with OpenRouter base URL | API key | Already implemented as `@dockline/openrouter`. |
| `openai-compatible` | OpenAI-compatible transport with custom base URL | API key/custom headers | Already implemented as `@dockline/openai-compatible`. |
| `openai-oauth` | `@dockline/openai-oauth` | OAuth/PKCE or official device/headless flow if available | Separate from API-key `openai` so sensitive auth stays isolated. |
| `copilot` | `@dockline/copilot` | Official device flow or SDK-delegated auth only | No token scraping or private endpoint dependency. |
| `minimax` | Upstream provider adapter if available; otherwise `@dockline/minimax` | API key first | Native package if LangChain/Vercel/another maintained dependency lacks robust support. |
| `minimax-token-plan` | Upstream provider adapter if available; otherwise `@dockline/minimax-token-plan` | Official token-plan/subscription flow only if documented | Keep subscription/account-backed behavior separate from simple API-key MiniMax. |
| `deepseek` | Upstream provider adapter if available; otherwise `@dockline/deepseek` | API key first | Native package if needed. |
| `moonshot` | Upstream provider adapter if available; otherwise `@dockline/moonshot` | API key first; official account flow only if documented | Native package if needed. |
| `alibaba` | Upstream provider adapter if available; otherwise `@dockline/alibaba` | API key/cloud credentials first | Should cover Qwen/DashScope-style access without making Dockline a cloud SDK. |

This table is a routing plan, not a promise that all packages exist today.
Before implementing each row, verify the current upstream package status and
provider terms.

## Integrator API Shape

The integrator-facing API should optimize for two modes:

1. Explicit imports for applications that want tight bundles and clear provider
   ownership.
2. A batteries-included import for applications that want the full provider
   picker experience quickly.

Possible explicit shape:

```ts
import { createModel } from "@dockline/core";
import { openai, google, minimax, openrouter } from "@dockline/providers";

const dockline = createDockline({
  providers: [
    openai(),
    google(),
    minimax(),
    openrouter(),
  ],
});

const providers = await dockline.listProviders();
```

Possible batteries-included shape:

```ts
import { createDockline, allProviders } from "@dockline/all";

const dockline = createDockline({
  providers: allProviders(),
});

const providers = await dockline.listProviders();
```

`@dockline/all` should be convenient, but it should not be the only path. Many
integrators will prefer explicit imports to avoid pulling provider dependencies
they do not expose.

## `@dockline/all` Package Contract

`@dockline/all` is an optional convenience package for apps that want a complete
provider picker without choosing provider packages one by one. It should compose
the same provider factories available through explicit packages; it should not
define a separate provider model or hide different behavior behind the same ids.

Target exports:

```ts
export { createDockline, createModel } from "@dockline/core";
export type {
  Dockline,
  ProviderMetadata,
  ProviderAuthMode,
  RuntimeOptionDescriptor,
} from "@dockline/core";

export { allProviders, defaultProviderPolicy } from "./providers";
export type { AllProvidersOptions, ProviderPolicy } from "./providers";

export {
  openai,
  anthropic,
  google,
  mistral,
  openrouter,
  openaiCompatible,
  minimax,
  deepseek,
  moonshot,
  alibaba,
} from "@dockline/providers";
```

`allProviders(options?)` should return provider registrations, not mutate global
state. Options should allow host applications to exclude provider families,
disable account-backed auth packages, and choose whether optional heavyweight
backings such as LangChain or Vercel AI SDK adapters are included.

Suggested option shape:

```ts
type AllProvidersOptions = {
  include?: string[];
  exclude?: string[];
  auth?: {
    apiKey?: boolean;
    accountBacked?: boolean;
    environmentProvided?: boolean;
  };
  backing?: {
    native?: boolean;
    langchain?: boolean;
    vercelAiSdk?: boolean;
    openaiCompatible?: boolean;
  };
};
```

Default behavior should favor predictable provider-picker coverage:

- include stable API-key providers and OpenAI-compatible/gateway providers;
- exclude experimental account-backed connectors unless the integrator opts in;
- expose metadata for unavailable optional flows instead of pretending they are
  ready;
- preserve provider ids used by explicit imports.

`@dockline/all` should not be a dependency of `@dockline/core` or individual
provider packages. It is a leaf package.

## Dependency And Bundle Tradeoffs

The optional package exists because provider coverage and bundle discipline pull
in opposite directions.

Explicit imports are the recommended default for production apps with known
provider lists. They keep install size, transitive dependencies, audit surface,
edge-runtime compatibility, and bundle output narrow.

`@dockline/all` is useful for CLIs, desktop apps, local tools, admin panels,
examples, and hosted provider-picker products where broad discovery matters more
than minimal dependency graphs. It may depend on broad upstream provider
libraries and native Dockline connectors that an explicit-import app would never
install.

Bundler expectations:

- mark provider modules as side-effect-free where possible;
- keep account-backed auth connectors split so they can be excluded;
- avoid importing Node-only token-store code from browser-safe provider modules;
- document any provider that cannot run in browser, edge, or serverless targets;
- prefer lazy provider initialization so listing providers does not immediately
  load SDK clients, read secrets, or start auth flows.

## End-User Flow

The target application UX is:

1. User chooses a provider, for example OpenAI.
2. User chooses a connection type:
   - API key
   - OAuth/PKCE when officially supported
   - device flow/headless device flow when officially supported
   - environment/IDE-provided auth where applicable
3. Dockline tests the connection.
4. Dockline lists available models when the provider supports discovery.
5. User chooses a model.
6. Dockline exposes runtime options for that model, including reasoning controls
   when supported:
   - none/unsupported
   - low/medium/high style effort
   - token/budget style controls
   - provider-specific options under a namespaced escape hatch
7. The host application enables workflows based on the selected model/runtime
   capabilities.

The key is that reasoning level is a runtime option attached to the selected
provider/model, not a universal Dockline promise.

Detailed auth UX, storage, and provider terms boundaries are specified in
[Auth UX Design](auth-design.md).

## Provider Metadata Needed

To support that UX, each installed provider should expose metadata such as:

```ts
type ProviderMetadata = {
  id: string;
  displayName: string;
  description?: string;
  backing?: "native" | "langchain" | "vercel-ai-sdk" | "openai-compatible" | "gateway";
  authModes: ProviderAuthMode[];
  supportsModelDiscovery: boolean;
  supportsConnectionTest: boolean;
  runtimeOptions?: RuntimeOptionDescriptor[];
};
```

This metadata is for provider picker UX. It is not a model capability database.
Core exposes `listProviderMetadata()` and `listAvailableProviders()` so host
applications can list installed providers even when older provider packages have
not added explicit metadata yet.

## Implementation Rules

- Prefer maintained upstream libraries for broad API-key coverage.
- Build native Dockline connectors when a major provider is missing upstream,
  upstream behavior is insufficient, or official auth flows are not supported.
- Keep account-backed auth packages isolated from API-key packages.
- Treat model capabilities as runtime/discovery output, not a giant static
  table maintained in core.
- Keep provider-specific escape hatches namespaced so advanced users can still
  access provider features without polluting the common API.
