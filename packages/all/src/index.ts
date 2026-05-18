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
