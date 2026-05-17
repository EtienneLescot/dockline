import {
  DocklineError,
  globalProviderRegistry,
  type BaseModelConfig,
  type ModelProvider,
} from "@dockline/core";
import {
  createLangChainChatProvider,
  type LangChainChatModelLike,
  type LangChainProviderConfig,
} from "@dockline/langchain-provider";

export type AnthropicConfig = LangChainProviderConfig & {
  provider: "anthropic";
  apiKey: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AnthropicChatModelFields = {
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
};

export type ChatAnthropicConstructor = new (
  fields: AnthropicChatModelFields,
) => LangChainChatModelLike;

export type AnthropicProviderOptions = {
  ChatAnthropic?: ChatAnthropicConstructor;
};

type AnthropicModule = {
  ChatAnthropic?: ChatAnthropicConstructor;
};

export const createAnthropicProvider = (
  options: AnthropicProviderOptions = {},
): ModelProvider<AnthropicConfig> => {
  const provider = createLangChainChatProvider<AnthropicConfig>({
    id: "anthropic",
    displayName: "Anthropic",
    metadata: {
      authModes: ["api-key"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      runtimeOptions: [
        {
          id: "temperature",
          type: "number",
          displayName: "Temperature",
          category: "sampling",
          min: 0,
          max: 1,
          step: 0.01,
        },
        {
          id: "maxOutputTokens",
          type: "integer",
          displayName: "Max output tokens",
          category: "output",
          min: 1,
          step: 1,
        },
      ],
    },
    async createChatModel(config) {
      const ChatAnthropic = options.ChatAnthropic ?? await loadChatAnthropic(config);

      return new ChatAnthropic({
        model: config.model,
        apiKey: getApiKey(config),
        temperature: config.temperature,
        maxTokens: config.maxOutputTokens,
      });
    },
  });

  return {
    ...provider,
    validateConfig(config: unknown): asserts config is AnthropicConfig {
      void getApiKey(config as Partial<AnthropicConfig> | null);
    },
  };
};

export const anthropic = createAnthropicProvider;

export const registerAnthropicProvider = (
  options: AnthropicProviderOptions = {},
): void => {
  globalProviderRegistry.set(createAnthropicProvider(options));
};

const getApiKey = (
  config: Pick<BaseModelConfig, "apiKey"> & { model?: string } | null,
): string => {
  if (typeof config?.apiKey === "string" && config.apiKey.length > 0) return config.apiKey;

  throw new DocklineError({
    code: "AUTHENTICATION_ERROR",
    message: "Anthropic requires an apiKey.",
    provider: "anthropic",
    model: config?.model,
    retryable: false,
  });
};

const loadChatAnthropic = async (
  config: Pick<AnthropicConfig, "model">,
): Promise<ChatAnthropicConstructor> => {
  let module: AnthropicModule;

  try {
    module = await dynamicImport("@langchain/anthropic") as AnthropicModule;
  } catch (error) {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "Install @langchain/anthropic to use the Anthropic provider.",
      provider: "anthropic",
      model: config.model,
      retryable: false,
      originalError: error,
    });
  }

  if (typeof module.ChatAnthropic !== "function") {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "@langchain/anthropic did not export ChatAnthropic.",
      provider: "anthropic",
      model: config.model,
      retryable: false,
    });
  }

  return module.ChatAnthropic;
};

const dynamicImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<unknown>;
