# Provider Routing And Resolver

Dockline should present one provider/auth/model surface to integrators while
using the best available backing implementation internally.

The integrator should not need to know whether a provider is executed through
Vercel AI SDK, LangChain, Dockline's OpenAI-compatible transport, a gateway
connector, or a native account-backed connector.

## Layers

Dockline separates three concepts:

1. **Catalog entry**: user-facing provider metadata from `@dockline/catalog`.
2. **Connector resolver**: chooses an executable backing for a catalog entry.
3. **Provider implementation**: actual `ModelProvider` registered in
   `@dockline/core`.

This separation is what keeps Dockline useful without making it a giant
handwritten provider implementation project.

## Provider Definition

A provider is the party that supplies credentials or runtime access.

- OpenAI: API provider.
- OpenRouter: gateway provider.
- Vercel AI Gateway: gateway provider.
- LM Studio: local runtime provider.
- GitHub Copilot: account-backed provider.
- Vercel AI SDK: adapter library, not a provider.
- LangChain: adapter library, not a provider.

## Resolver Input

Implemented in `@dockline/resolver`:

```ts
type ResolveConnectorInput = {
  provider: string;
  authMode?: ProviderAuthMode;
  preferredBacking?: ProviderBacking;
  environment?: {
    node?: boolean;
    browser?: boolean;
    edge?: boolean;
    vscode?: boolean;
  };
  installedPackages?: string[];
};
```

## Resolver Output

Implemented in `@dockline/resolver`:

```ts
type ResolveConnectorResult =
  | {
      ok: true;
      provider: ModelProvider;
      catalogProvider: ProviderCatalogEntry;
      backing: ProviderBacking;
      requiredPackages: string[];
    }
  | {
      ok: false;
      status:
        | "unknown-provider"
        | "unsupported-auth-mode"
        | "unsupported-environment"
        | "missing-package"
        | "planned-native"
        | "unsupported";
      provider: string;
      message: string;
      requiredPackages?: string[];
      availableBackings?: ProviderBacking[];
    };
```

The resolver should fail clearly when a catalog entry is not executable yet.
Catalog presence is not the same thing as runtime availability.

## Backing Priority

Default backing priority:

1. Native Dockline connector, when the provider needs account-backed auth,
   official environment auth, or special runtime behavior.
2. Dockline gateway/OpenAI-compatible connector, when the selected provider is a
   gateway or custom endpoint already covered by Dockline transport.
3. Vercel AI SDK, as the primary broad provider backing.
4. LangChain, as complement for providers not covered by AI SDK or where an app
   explicitly wants LangChain behavior.
5. Custom host-provided provider.

Host applications should be able to override this priority.

## Gateway Rules

Gateways are user-selected providers:

| Provider | User credential | Resolver backing |
| --- | --- | --- |
| `openrouter` | OpenRouter key | Dockline gateway connector first; AI SDK/LangChain optional |
| `vercel-ai-gateway` | Vercel Gateway credentials | AI SDK Gateway provider first |
| `openai-compatible` | Endpoint-specific key/header | Dockline OpenAI-compatible transport first |
| `portkey` | Portkey key | AI SDK/community provider until native needed |
| `requesty` | Requesty key | AI SDK/community provider until native needed |
| `langdb` | LangDB key | AI SDK/community provider until native needed |

Gateway model discovery is scoped to the gateway account. It must not be
presented as direct upstream-provider discovery.

## Account-Backed Rules

Account-backed providers must be native or SDK-delegated and isolated from
API-key provider packages.

Targets:

- `openai-chatgpt-account`
- `github-copilot`
- `vscode-lm`
- `codex-cli`

Rules:

- documented flows only;
- no token scraping;
- no private endpoints;
- no silent token persistence;
- explicit host-provided `TokenStore` for persistence;
- clear scopes and logout/status behavior.

## `@dockline/all`

`@dockline/all` should remain a convenience package. It can re-export:

- the catalog;
- current executable provider factories;
- resolver helpers;
- optional bridge helpers.

It should not be the only integration path. Production apps with known provider
sets should be able to use explicit imports.

## Implementation Order

1. Keep `@dockline/catalog` as source of truth for provider picker metadata.
2. Keep `@dockline/resolver` as the backing-neutral resolver package.
3. Resolve currently implemented providers first:
   - `openrouter`
   - `openai-compatible`
   - `openai`
   - `anthropic`
   - `google`
   - `mistral`
   - OpenAI-compatible presets
4. Resolve one AI SDK-backed provider through `@dockline/ai-sdk`.
5. Add Vercel AI Gateway as a gateway provider.
6. Improve missing-package diagnostics for catalog entries not executable in the
   current install.
7. Add native account-backed connectors only after official auth flows are
   confirmed.
