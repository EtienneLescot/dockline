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
  `globalProviderRegistry`, `createModel`, `listProviders`,
  `testProviderConnection`, `listProviderModels`, `validateBaseModelConfig`,
  `validateProviderDiscoveryConfig`, `TokenStore`, `TokenRecord`,
  `ProviderContext`, and `MemoryTokenStore`.
- Error primitives: `DocklineError`, `NormalizedModelError`,
  `normalizeUnknownError`, and `toDocklineError`.

Stable APIs should avoid breaking changes unless the package version signals
them.

## Alpha API

Coding-agent runtime contracts are alpha. Import them from the package
subpath:

```ts
import type { CodingAgentRuntime } from "@dockline/core/experimental";
```

The package root also exposes an `experimental` namespace for discoverability,
but the `/experimental` subpath is the preferred import for alpha-only types.
Alpha APIs can change or move before a stable release.
