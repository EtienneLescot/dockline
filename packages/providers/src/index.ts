import {
  DocklineError,
  type BaseModelConfig,
  type ModelDescriptor,
  type ModelProvider,
  type ProviderAuthMode,
  type ProviderBacking,
  type ProviderDiscoveryConfig,
  type ProviderMetadata,
  type TestConnectionResult,
  type UniversalChatModel,
} from "@dockline/core";
import {
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
  type OpenAICompatibleProviderOptions,
} from "@dockline/openai-compatible";
import {
  openai as createOpenAIProvider,
  type OpenAIConfig,
  type OpenAIProviderOptions,
} from "@dockline/openai";
import {
  anthropic as createAnthropicProvider,
  type AnthropicConfig,
  type AnthropicProviderOptions,
} from "@dockline/anthropic";
import {
  createOpenRouterProvider,
  type OpenRouterConfig,
} from "@dockline/openrouter";

export type {
  OpenAIConfig,
  OpenAIProviderOptions,
} from "@dockline/openai";
export type {
  AnthropicConfig,
  AnthropicProviderOptions,
} from "@dockline/anthropic";
export type {
  OpenAICompatibleConfig,
  OpenAICompatibleProviderOptions,
} from "@dockline/openai-compatible";
export type { OpenRouterConfig } from "@dockline/openrouter";

export type ProviderFactory<Config extends BaseModelConfig = BaseModelConfig> = () => ModelProvider<Config>;

export type PlannedProviderId =
  | "google"
  | "mistral"
  | "minimax"
  | "deepseek"
  | "moonshot"
  | "alibaba"
  | "copilot"
  | "openai-oauth";

export type PlannedProviderOptions = {
  id?: PlannedProviderId;
  displayName?: string;
};

export const openrouter = (): ModelProvider<OpenRouterConfig> => withMetadata(
  createOpenRouterProvider(),
  {
    id: "openrouter",
    displayName: "OpenRouter",
    backing: "gateway",
    authModes: ["api-key"],
    supportsModelDiscovery: true,
    supportsConnectionTest: true,
  },
);

export const openaiCompatible = (
  options?: OpenAICompatibleProviderOptions,
): ModelProvider<OpenAICompatibleConfig> => {
  const provider = createOpenAICompatibleProvider(options);

  return withMetadata(provider, {
    id: provider.id,
    displayName: provider.displayName ?? "OpenAI-compatible",
    backing: "openai-compatible",
    authModes: ["api-key", "custom"],
    supportsModelDiscovery: true,
    supportsConnectionTest: true,
  });
};

export const openai = (
  options?: OpenAIProviderOptions,
): ModelProvider<OpenAIConfig> => createOpenAIProvider(options);
export const google = (): ModelProvider => plannedProvider({
  id: "google",
  displayName: "Google Gemini",
  backing: "langchain",
  authModes: ["api-key"],
});
export const anthropic = (
  options?: AnthropicProviderOptions,
): ModelProvider<AnthropicConfig> => createAnthropicProvider(options);
export const mistral = (): ModelProvider => plannedProvider({
  id: "mistral",
  displayName: "Mistral",
  backing: "langchain",
  authModes: ["api-key"],
});
export const minimax = (): ModelProvider => plannedProvider({
  id: "minimax",
  displayName: "MiniMax",
  backing: "native",
  authModes: ["api-key"],
});
export const deepseek = (): ModelProvider => plannedProvider({
  id: "deepseek",
  displayName: "DeepSeek",
  backing: "native",
  authModes: ["api-key"],
});
export const moonshot = (): ModelProvider => plannedProvider({
  id: "moonshot",
  displayName: "Moonshot",
  backing: "native",
  authModes: ["api-key"],
});
export const alibaba = (): ModelProvider => plannedProvider({
  id: "alibaba",
  displayName: "Alibaba/Qwen",
  backing: "native",
  authModes: ["api-key", "custom"],
});
export const copilot = (): ModelProvider => plannedProvider({
  id: "copilot",
  displayName: "GitHub Copilot",
  backing: "native",
  authModes: ["device-code", "environment"],
});
export const openaiOAuth = (): ModelProvider => plannedProvider({
  id: "openai-oauth",
  displayName: "OpenAI OAuth",
  backing: "native",
  authModes: ["oauth", "device-code"],
});

const withMetadata = <Config extends BaseModelConfig>(
  provider: ModelProvider<Config>,
  metadata: ProviderMetadata,
): ModelProvider<Config> => ({
  ...provider,
  metadata,
});

type PlannedProviderSpec = {
  id: PlannedProviderId;
  displayName: string;
  backing: ProviderBacking;
  authModes: ProviderAuthMode[];
};

const plannedProvider = (spec: PlannedProviderSpec): ModelProvider => {
  const unsupported = (model?: string): DocklineError =>
    new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: `${spec.displayName} provider is planned but not implemented yet.`,
      provider: spec.id,
      model,
      retryable: false,
    });

  return {
    id: spec.id,
    displayName: spec.displayName,
    metadata: {
      id: spec.id,
      displayName: spec.displayName,
      backing: spec.backing,
      authModes: spec.authModes,
      supportsModelDiscovery: false,
      supportsConnectionTest: true,
    },
    validateConfig(config: unknown): asserts config is BaseModelConfig {
      void config;
    },
    async createModel(config: BaseModelConfig): Promise<UniversalChatModel> {
      throw unsupported(config.model);
    },
    async testConnection(config: BaseModelConfig): Promise<TestConnectionResult> {
      return {
        ok: false,
        status: "unsupported",
        provider: spec.id,
        model: config.model,
        message: unsupported(config.model).message,
        retryable: false,
      };
    },
    async listModels(
      config: ProviderDiscoveryConfig & Partial<BaseModelConfig>,
    ): Promise<ModelDescriptor[]> {
      throw unsupported(config.model);
    },
  };
};
