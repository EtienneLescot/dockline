# Dockline Core API

`@dockline/core` is the stable public boundary for model providers, chat model
contracts, messages, capabilities, normalized errors, and provider registry
helpers.

## Stable API

The package root exports:

- Capability types and helpers: `ModelCapabilities`, `CapabilityName`,
  `ToolCallingMode`, `StructuredOutputMode`, `noModelCapabilities`,
  `chatModelCapabilities`, `hasCapability`, `getMissingCapabilities`,
  `CapabilityProfile`, `mergeCapabilityProfile`, and
  `capabilitiesFromProfile`.
- Requirement checks: `assertCapability`, `assertCapabilities`, and
  `assertModelRequirements`.
- Message, tool, response format, generation, stream event, and token usage
  types.
- Provider primitives: `BaseModelConfig`, `ModelProvider`, `ProviderRegistry`,
  `ProviderMetadata`, `ProviderAuthMode`, `ProviderBacking`,
  `RuntimeOptionDescriptor`, `ReasoningOptionDescriptor`,
  `globalProviderRegistry`, `createModel`, `listProviders`,
  `listProviderMetadata`, `listAvailableProviders`, `getProviderMetadata`,
  `testProviderConnection`, `listProviderModels`, `validateBaseModelConfig`,
  `validateProviderDiscoveryConfig`, `TokenStore`, `TokenRecord`,
  `ProviderContext`, and `MemoryTokenStore`.
- Error primitives: `DocklineError`, `NormalizedModelError`,
  `normalizeUnknownError`, and `toDocklineError`.

Stable APIs should avoid breaking changes unless the package version signals
them.

## Provider Metadata

Providers may expose optional `metadata` for provider-picker UX:

```ts
type ProviderMetadata = {
  id: string;
  displayName: string;
  description?: string;
  backing?: ProviderBacking;
  authModes: ProviderAuthMode[];
  supportsModelDiscovery: boolean;
  supportsConnectionTest: boolean;
  runtimeOptions?: RuntimeOptionDescriptor[];
};
```

`metadata` is intentionally advisory. It describes the installed provider
package and common runtime controls; model-specific capabilities still come from
model discovery, provider responses, or capability profiles.

Use `listProviderMetadata(registry)` or `listAvailableProviders(registry)` to
get normalized catalog entries. Providers without metadata are included with
fallback values derived from the registered provider:

- `id` comes from `provider.id`.
- `displayName` comes from `provider.displayName` or the provider id.
- `supportsModelDiscovery` and `supportsConnectionTest` reflect whether the
  optional hooks are implemented.
- `authModes` defaults to an empty list.

## Alpha API

Coding-agent runtime contracts are alpha. Import them from the package
subpath:

```ts
import type { CodingAgentRuntime } from "@dockline/core/experimental";
```

The package root also exposes an `experimental` namespace for discoverability,
but the `/experimental` subpath is the preferred import for alpha-only types.
Alpha APIs can change or move before a stable release.
