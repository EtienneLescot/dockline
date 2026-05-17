# Capability Profiles

Capability profiles are advisory metadata for provider/model combinations. They
are intentionally small and non-exhaustive in the alpha line: a profile records
only what Dockline knows well enough to expose, and consumers should still expect
provider-side validation errors when a model or account does not support a
feature.

Capability profiles are not the product center of gravity. Dockline's main UX is
provider connection: helping application developers expose a broad provider and
model choice to their users, through API keys or official account-backed auth
flows. Capabilities describe the runtime result of that choice.

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

## Alpha Default Profiles

These profiles document Dockline's current alpha defaults. They describe what
the connector currently assumes when a caller does not pass runtime capability
overrides. They are not exhaustive provider or model truth, and they should not
be used as a substitute for provider documentation, model cards, account-level
entitlements, or runtime errors.

OpenAI-compatible endpoints share one broad provider-level default because each
server decides which models and request options it actually supports:

```ts
const openAICompatibleDefaultProfile = {
  provider: "openai-compatible",
  displayName: "OpenAI-compatible",
  capabilities: {
    textGeneration: true,
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    vision: true,
  },
  toolCallingMode: "native",
  structuredOutputMode: "json-schema",
  notes: [
    "Provider-level default only; individual OpenAI-compatible servers and models can support less or more.",
    "Callers can override capabilities through model/provider config when the exact endpoint behavior is known.",
    "URL image parts are mapped for vision-style requests; file parts remain outside this default connector path.",
  ],
} satisfies CapabilityProfile;
```

OpenRouter currently uses the OpenAI-compatible connector with OpenRouter
headers and base URL. Its default profile should therefore mirror the inherited
OpenAI-compatible request path while making model routing explicit:

```ts
const openRouterDefaultProfile = {
  provider: "openrouter",
  displayName: "OpenRouter",
  capabilities: {
    textGeneration: true,
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    vision: true,
  },
  toolCallingMode: "native",
  structuredOutputMode: "json-schema",
  notes: [
    "Inherited alpha default from the OpenAI-compatible connector.",
    "Actual support depends on the selected OpenRouter model, routed upstream provider, account, and request options.",
    "This is not a model catalog; model-specific OpenRouter profiles should be added only when Dockline has maintainable source data.",
  ],
} satisfies CapabilityProfile;
```

LangChain is an adapter, not a provider. It should not claim capabilities beyond
the wrapped `UniversalChatModel`; any documentation-only profile for it should
be empty and clearly marked as delegating:

```ts
const langChainAdapterDefaultProfile = {
  provider: "langchain",
  displayName: "LangChain adapter",
  capabilities: {},
  notes: [
    "Adapter profile only; use the wrapped Dockline model profile for actual model capabilities.",
    "Tool binding, response format, streaming, vision parts, and token metadata are delegated or translated.",
    "The adapter does not add auth, provider access, or model support on its own.",
  ],
} satisfies CapabilityProfile;
```

For all three profiles, omitted capability flags still mean unknown. The alpha
defaults above intentionally mention only behavior that the current packages
map in code. A provider/model can still reject a request even when a default
profile marks the broad capability as `true`.

## Boundary

Dockline should not maintain an exhaustive capability registry for every model
from OpenAI, Google, Anthropic, DeepSeek, Moonshot, MiniMax, Alibaba, or other
providers. That information changes too often and belongs primarily to provider
documentation, discovery endpoints, model cards, and runtime responses.

Dockline may maintain:

- connector-level defaults
- auth-mode metadata
- runtime option metadata when exposed by a provider
- conservative model overlays when there is a maintainable source
- host-application overrides

Dockline core should not become a central LLM capability database.

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
- Prefer provider discovery/runtime data over handwritten model facts.
- Include `source` or `updatedAt` only when they help maintainers evaluate
  staleness; do not imply that Dockline continuously verifies provider docs.
- Do not encode every provider-specific option. Use `notes` for short
  implementation caveats and leave detailed behavior to provider docs.
- Runtime provider implementations should continue to validate and normalize
  provider errors instead of relying on profiles as enforcement.

## Future Code Constants

When Dockline promotes profile data from documentation into package code, keep
the constants close to the packages that own the behavior:

- OpenAI-compatible defaults should live in
  `packages/openai-compatible/src/capability-profiles.ts`.
- OpenRouter defaults and any future OpenRouter model-specific overlays should
  live in `packages/openrouter/src/capability-profiles.ts`.
- LangChain adapter guidance should live in
  `packages/langchain/src/capability-profiles.ts` only if the package needs a
  documentation/export surface; actual capability data should continue to come
  from the wrapped model.
- Shared types, merge helpers, and registry-neutral utilities belong in
  `packages/core/src/capabilities.ts`. A central provider/model catalog should
  not live in core unless Dockline later adds an explicit registry package.

## Current Boundary

Dockline does not yet ship provider/model registries of known profiles or the
constants shown above. The core helpers only define the shared shape and merge
behavior so provider packages can adopt profiles incrementally without coupling
themselves to a central catalog.
