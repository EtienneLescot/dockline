import {
  globalProviderRegistry,
  type ModelProvider,
  type ProviderRegistry,
} from "@dockline/core";
import {
  alibaba,
  anthropic,
  copilot,
  deepseek,
  google,
  minimax,
  mistral,
  moonshot,
  openai,
  openaiCompatible,
  openaiOAuth,
  openrouter,
  type ProviderFactory,
} from "@dockline/providers";
import {
  createConnectorResolver,
  resolveConnector,
  type ConnectorCandidate,
  type ConnectorResolver,
  type ResolveConnectorInput,
  type ResolveConnectorResult,
} from "@dockline/resolver";

export {
  alibaba,
  anthropic,
  copilot,
  deepseek,
  google,
  minimax,
  mistral,
  moonshot,
  openai,
  openaiCompatible,
  openaiOAuth,
  openrouter,
  type OpenAICompatibleConfig,
  type OpenAICompatibleProviderOptions,
  type OpenRouterConfig,
  type PlannedProviderId,
  type PlannedProviderOptions,
  type ProviderFactory,
} from "@dockline/providers";
export {
  createAISDKChatProvider,
  registerAISDKChatProvider,
  type AISDKLanguageModelV3Like,
  type AISDKProviderConfig,
  type AISDKProviderOptions,
} from "@dockline/ai-sdk";
export {
  getCatalogProvider,
  listCatalogProviderIds,
  listCatalogProviders,
  providerCatalog,
  requireCatalogProvider,
  type CatalogSourceId,
  type CapabilityGroup,
  type ProviderCatalogEntry,
  type ProviderCatalogFilter,
  type ProviderCatalogId,
  type ProviderCatalogSource,
  type ProviderCatalogStatus,
  type ProviderKind,
} from "@dockline/catalog";
export {
  createConnectorResolver,
  listResolvableCatalogProviders,
  resolveConnector,
  type ConnectorCandidate,
  type ConnectorCandidateStatus,
  type ConnectorEnvironment,
  type ConnectorEnvironmentName,
  type ConnectorResolver,
  type ConnectorResolverOptions,
  type ResolveConnectorFailure,
  type ResolveConnectorInput,
  type ResolveConnectorResult,
  type ResolveConnectorStatus,
  type ResolveConnectorSuccess,
} from "@dockline/resolver";

export const allProviderFactories = {
  openrouter,
  openaiCompatible,
  openai,
  google,
  anthropic,
  mistral,
  minimax,
  deepseek,
  moonshot,
  alibaba,
  copilot,
  openaiOAuth,
} satisfies Record<string, ProviderFactory>;

export type AllProviderId = keyof typeof allProviderFactories;

export const allProviders = (): ModelProvider[] =>
  Object.values(allProviderFactories).map((createProvider) => createProvider());

export const registerAllProviders = (
  registry: ProviderRegistry = globalProviderRegistry,
): ProviderRegistry => {
  for (const provider of allProviders()) {
    registry.set(provider);
  }

  return registry;
};

export const allConnectorCandidates = (): ConnectorCandidate[] => [
  {
    catalogProviderId: "openrouter",
    backing: "gateway",
    authModes: ["api-key"],
    createProvider: openrouter,
  },
  {
    catalogProviderId: "openai-compatible",
    backing: "openai-compatible",
    authModes: ["api-key", "custom"],
    createProvider: openaiCompatible,
  },
  {
    catalogProviderId: "openai",
    backing: "langchain",
    authModes: ["api-key"],
    createProvider: openai,
  },
  {
    catalogProviderId: "google",
    backing: "langchain",
    authModes: ["api-key"],
    createProvider: google,
  },
  {
    catalogProviderId: "anthropic",
    backing: "langchain",
    authModes: ["api-key"],
    createProvider: anthropic,
  },
  {
    catalogProviderId: "mistral",
    backing: "langchain",
    authModes: ["api-key"],
    createProvider: mistral,
  },
  {
    catalogProviderId: "minimax",
    backing: "openai-compatible",
    authModes: ["api-key"],
    createProvider: minimax,
  },
  {
    catalogProviderId: "deepseek",
    backing: "openai-compatible",
    authModes: ["api-key"],
    createProvider: deepseek,
  },
  {
    catalogProviderId: "moonshot",
    backing: "openai-compatible",
    authModes: ["api-key"],
    createProvider: moonshot,
  },
  {
    catalogProviderId: "alibaba",
    backing: "openai-compatible",
    authModes: ["api-key"],
    createProvider: alibaba,
  },
  {
    catalogProviderId: "github-copilot",
    providerId: "copilot",
    backing: "native",
    authModes: ["device-code", "environment"],
    status: "planned",
    message: "GitHub Copilot device-flow support is planned but not implemented yet.",
  },
  {
    catalogProviderId: "openai-chatgpt-account",
    providerId: "openai-oauth",
    backing: "native",
    authModes: ["oauth", "device-code"],
    status: "planned",
    message: "OpenAI ChatGPT account auth is planned and will require official documented flows.",
  },
];

export const createAllConnectorResolver = (): ConnectorResolver =>
  createConnectorResolver({ candidates: allConnectorCandidates() });

export const resolveAllConnector = (
  input: ResolveConnectorInput,
): ResolveConnectorResult =>
  resolveConnector(input, { candidates: allConnectorCandidates() });
