# Capability Profiles

Capability profiles are advisory metadata for provider/model combinations. They
are intentionally small and non-exhaustive in the alpha line: a profile records
only what Dockline knows well enough to expose, and consumers should still expect
provider-side validation errors when a model or account does not support a
feature.

Profiles do not replace `ModelCapabilities`. Runtime model instances still
expose a complete boolean capability map. A profile can be used before model
creation, during provider discovery, or as a maintainable known-default layer
that callers may override at runtime.

## Shape

The core profile shape is:

```ts
type CapabilityProfile = {
  provider: string;
  model?: string;
  displayName?: string;
  capabilities?: Partial<ModelCapabilities>;
  toolCallingMode?: ToolCallingMode;
  structuredOutputMode?: StructuredOutputMode;
  contextWindow?: number;
  maxOutputTokens?: number;
  notes?: readonly string[];
  source?: string;
  updatedAt?: string;
};
```

Only `provider` is required. `model` may be omitted for provider-level defaults.
`capabilities` is partial by design; omitted flags mean unknown, not unsupported.
Use `false` only when Dockline intentionally wants to mark a capability as known
unsupported for that profile.

The optional mode fields are for behavior that matters to callers but should not
be flattened into a boolean:

- `toolCallingMode`: `native`, `emulated`, or `unsupported`.
- `structuredOutputMode`: `json-schema`, `provider-native`, `prompt-fallback`,
  or `unsupported`.

Numeric limits such as `contextWindow` and `maxOutputTokens` are best-effort
metadata. They may vary by provider routing, account tier, regional deployment,
or provider-side changes.

## Merge Policy

Known profiles should be treated as defaults. Runtime overrides win because
callers may know the exact deployment, model revision, server, or account
entitlement.

```ts
const known = {
  provider: "openrouter",
  model: "example/model",
  capabilities: {
    textGeneration: true,
    streaming: true,
  },
};

const profile = mergeCapabilityProfile(known, {
  capabilities: {
    toolCalling: true,
  },
});

const capabilities = capabilitiesFromProfile(profile);
```

`capabilitiesFromProfile()` returns a complete `ModelCapabilities` map by
applying the partial profile over `noModelCapabilities()` unless another default
map is provided. These helper names are currently incubating in the core
capabilities module; root package export policy can be decided when the profile
contract is promoted.

## Maintenance Rules

- Keep profiles conservative. Prefer unknown over optimistic `true`.
- Keep provider-level profiles broad and model-level profiles narrow.
- Include `source` or `updatedAt` only when they help maintainers evaluate
  staleness; do not imply that Dockline continuously verifies provider docs.
- Do not encode every provider-specific option. Use `notes` for short
  implementation caveats and leave detailed behavior to provider docs.
- Runtime provider implementations should continue to validate and normalize
  provider errors instead of relying on profiles as enforcement.

## Current Boundary

Dockline does not yet ship provider/model registries of known profiles. The core
helpers only define the shared shape and merge behavior so provider packages can
adopt profiles incrementally without coupling themselves to a central catalog.
