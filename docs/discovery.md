# Provider Discovery

Dockline discovery is an optional provider contract for checking credentials and
listing available models without constructing a chat model.

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
