# Provider Discovery

Dockline discovery is an optional executable-provider contract for checking
credentials and listing available models without constructing a chat model.

For the broad user-facing provider picker, start with `@dockline/catalog`.
Discovery runs after a catalog entry has been resolved to an installed
executable provider/backing.

## Core Types

Providers may implement these optional `ModelProvider` hooks:

```ts
testConnection?(
  config: BaseModelConfig,
  context?: ProviderContext,
): Promise<TestConnectionResult>;

listModels?(
  config: ProviderDiscoveryConfig,
  context?: ProviderContext,
): Promise<ModelDescriptor[]>;
```

`ProviderDiscoveryConfig` is the same base provider configuration shape as
`BaseModelConfig`, except `model` is optional. It supports provider id, auth
fields, base URL, headers, token-store backed context, and provider-specific
extension fields.

`TestConnectionResult` has this shape:

```ts
type TestConnectionResult = {
  ok: boolean;
  status:
    | "ok"
    | "unauthorized"
    | "misconfigured"
    | "unavailable"
    | "unsupported";
  provider: string;
  model?: string;
  message?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};
```

## Helper Functions

`testProviderConnection(config, context?, registry?)` validates a full
`BaseModelConfig`, resolves the provider, runs provider-specific validation when
available, and delegates to `provider.testConnection`. If the provider is
registered but does not implement the hook, the helper returns:

```ts
{
  ok: false,
  status: "unsupported",
  provider,
  model,
  retryable: false
}
```

`listProviderModels(config, context?, registry?)` validates
`ProviderDiscoveryConfig`, resolves the provider, and delegates to
`provider.listModels`. It fills a missing `provider` field on returned model
descriptors with the provider id from the request. If the provider is registered
but does not implement the hook, the helper rejects with `DocklineError`.

`listProviderMetadata(registry?)` and `listAvailableProviders(registry?)` return
provider-picker metadata without making provider network requests. Use these
functions before asking the user for credentials:

```ts
import { listProviderMetadata } from "@dockline/core";

const providers = listProviderMetadata();

for (const provider of providers) {
  console.log(provider.id, provider.authModes, {
    supportsConnectionTest: provider.supportsConnectionTest,
    supportsModelDiscovery: provider.supportsModelDiscovery,
    runtimeOptions: provider.runtimeOptions,
  });
}
```

## Integrator Flow

A provider picker should separate static metadata from account-specific
discovery:

1. List candidate providers with `@dockline/catalog`.
2. Resolve the chosen catalog provider to an installed executable provider.
3. Register or retrieve that provider in the application registry.
4. Call `listProviderMetadata()` for installed-provider details such as backing
   type, supported auth modes, and whether connection testing/model discovery
   are available.
5. Let the user choose an auth mode from catalog/provider metadata.
6. Build a `ProviderDiscoveryConfig` from the chosen provider, auth mode,
   credential fields, base URL, headers, and provider-specific fields.
7. Call `testProviderConnection()` once a model id is known, or with a default
   model id when the provider requires one for validation.
8. Call `listProviderModels()` to fetch the models visible to the configured
   account, endpoint, region, and auth mode.
9. Let the user choose a model and runtime options from provider metadata plus
   the selected model's capabilities.
10. Pass the selected values to `createModel()`. Request-level sampling,
   reasoning, output, and provider-specific options belong in
   `GenerateInput.providerOptions` unless a provider documents a config-level
   field.

Example picker flow:

```ts
import {
  createModel,
  listProviderMetadata,
  listProviderModels,
  testProviderConnection,
  type BaseModelConfig,
  type ProviderDiscoveryConfig,
} from "@dockline/core";
import { registerOpenRouterProvider } from "@dockline/openrouter";

registerOpenRouterProvider();

const selectedProvider = listProviderMetadata().find((provider) => provider.id === "openrouter");
const selectedAuth = selectedProvider?.authModes[0] ?? "api-key";

const discoveryConfig: ProviderDiscoveryConfig = {
  provider: "openrouter",
  auth: selectedAuth,
  apiKey: process.env.OPENROUTER_API_KEY,
};

const models = await listProviderModels(discoveryConfig);
const selectedModel = models.find((model) => model.id.includes("gpt-4o-mini")) ?? models[0];

if (!selectedModel) {
  throw new Error("No OpenRouter models are visible for this account.");
}

const modelConfig: BaseModelConfig = {
  ...discoveryConfig,
  model: selectedModel.id,
};

const connection = await testProviderConnection(modelConfig);

if (!connection.ok) {
  throw new Error(connection.message ?? `Connection test failed: ${connection.status}`);
}

const model = await createModel(modelConfig);

await model.generate({
  messages: [{ role: "user", content: "Say hello." }],
  providerOptions: {
    reasoning: { effort: "medium" },
  },
});
```

## Provider-Side Contract

Provider implementations should keep discovery cheap and non-mutating:

- `testConnection` should perform the smallest legal provider request that
  proves credentials and endpoint configuration work. It should not create a
  chat completion unless no lower-cost endpoint exists.
- Return `status: "ok"` only when the configured provider credentials are usable.
- Return `status: "unauthorized"` for invalid, expired, missing, or insufficient
  credentials.
- Return `status: "misconfigured"` for invalid base URLs, unsupported auth
  modes, malformed provider-specific fields, or a model id that the provider can
  identify as invalid.
- Return `status: "unavailable"` for network failures, rate limits, provider
  outages, or other temporary provider-side failures; set `retryable` when known.
- Throw `DocklineError` only for local contract failures or unexpected provider
  failures that cannot be represented as a normal result.

`listModels` returns provider-visible model descriptors. The returned list is not
required to be complete: providers may omit models that are unavailable to the
configured account, region, endpoint, or auth mode. When capability data is not
available from the provider API, omit `capabilities` rather than guessing.

Provider packages that support account-specific model visibility should accept
auth fields from `ProviderDiscoveryConfig` and `ProviderContext` in the same way
their `createModel` implementation does.

### Provider Metadata

Provider metadata is the static contract that lets an integrator build a picker
without probing the provider:

```ts
import type { ModelProvider } from "@dockline/core";

export const provider: ModelProvider = {
  id: "example",
  displayName: "Example Provider",
  metadata: {
    id: "example",
    displayName: "Example Provider",
    backing: "native",
    authModes: ["api-key", "oauth"],
    supportsConnectionTest: true,
    supportsModelDiscovery: true,
    runtimeOptions: [
      {
        id: "reasoning.effort",
        type: "enum",
        category: "reasoning",
        displayName: "Reasoning effort",
        enumValues: [
          { value: "low", displayName: "Low" },
          { value: "medium", displayName: "Medium" },
          { value: "high", displayName: "High" },
        ],
      },
      {
        id: "temperature",
        type: "number",
        category: "sampling",
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.7,
      },
    ],
  },
  async createModel(config, context) {
    void config;
    void context;
    throw new Error("createModel omitted from discovery example.");
  },
  async testConnection(config, context) {
    void context;
    return testConnection(config);
  },
  async listModels(config, context) {
    void context;
    return listModels(config);
  },
};
```

Use stable option ids that map cleanly into request config. For OpenAI-compatible
chat-completions providers, request-level values generally flow through
`GenerateInput.providerOptions`, while first-class Dockline fields such as
`temperature`, `maxOutputTokens`, `stopSequences`, `tools`, and
`responseFormat` should use the normalized request fields.

### `testConnection`

Provider-side `testConnection` should return a normalized result instead of
throwing for expected provider responses:

```ts
import type { BaseModelConfig, TestConnectionResult } from "@dockline/core";

async function testConnection(config: BaseModelConfig): Promise<TestConnectionResult> {
  const response = await fetch("https://api.example.com/v1/models", {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });

  if (response.ok) {
    return {
      ok: true,
      status: "ok",
      provider: config.provider,
      model: config.model,
      retryable: false,
    };
  }

  return {
    ok: false,
    status: response.status === 401 || response.status === 403
      ? "unauthorized"
      : response.status >= 500 || response.status === 429
        ? "unavailable"
        : "misconfigured",
    provider: config.provider,
    model: config.model,
    message: await response.text(),
    retryable: response.status === 429 || response.status >= 500,
    details: { statusCode: response.status },
  };
}
```

The connection test should validate the selected auth mode, base URL, headers,
token-store context, and provider-specific config. If the provider can verify
the selected model cheaply, include that in the same request. If it cannot,
verify the endpoint and credentials and leave model validation to generation.

### `listModels`

Provider-side `listModels` returns the account-visible model list for the same
auth and endpoint configuration used by `createModel`:

```ts
import {
  DocklineError,
  type ModelDescriptor,
  type ProviderDiscoveryConfig,
} from "@dockline/core";

async function listModels(config: ProviderDiscoveryConfig): Promise<ModelDescriptor[]> {
  const response = await fetch("https://api.example.com/v1/models", {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });

  if (!response.ok) {
    throw new DocklineError({
      code: response.status === 401 ? "AUTHENTICATION_ERROR" : "PROVIDER_UNAVAILABLE",
      message: `Model discovery failed with HTTP ${response.status}.`,
      provider: config.provider,
      model: config.model,
      statusCode: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const body = await response.json() as {
    data?: Array<{ id?: unknown; name?: unknown }>;
  };

  return (body.data ?? []).flatMap((model): ModelDescriptor[] => {
    if (typeof model.id !== "string") return [];

    return [{
      id: model.id,
      provider: config.provider,
      displayName: typeof model.name === "string" ? model.name : undefined,
    }];
  });
}
```

Only include capability fields that are known for that model. Prefer omitting
unknown capability data over copying marketing claims or guessing from model
names.
