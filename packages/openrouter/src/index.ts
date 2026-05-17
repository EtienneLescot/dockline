import { DocklineError, globalProviderRegistry, type BaseModelConfig, type ModelProvider } from "@dockline/core";
import {
  createOpenAICompatibleModel,
  type OpenAICompatibleConfig,
  type OpenAICompatibleProviderOptions,
} from "@dockline/openai-compatible";

export type OpenRouterConfig = BaseModelConfig & {
  provider: "openrouter";
  apiKey: string;
  appName?: string;
  appURL?: string;
};

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const createOpenRouterModel = (config: OpenRouterConfig) => {
  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (config.appName) headers["X-Title"] = config.appName;
  if (config.appURL) headers["HTTP-Referer"] = config.appURL;

  return createOpenAICompatibleModel(
    {
      ...(config as OpenAICompatibleConfig),
      provider: "openrouter",
      baseURL: OPENROUTER_BASE_URL,
      headers,
    },
    openRouterOptions,
  );
};

export const createOpenRouterProvider = (): ModelProvider<OpenRouterConfig> => ({
  id: "openrouter",
  displayName: "OpenRouter",
  validateConfig(config: unknown): asserts config is OpenRouterConfig {
    const candidate = config as Partial<OpenRouterConfig> | null;

    if (typeof candidate?.apiKey !== "string" || candidate.apiKey.length === 0) {
      throw new DocklineError({
        code: "AUTHENTICATION_ERROR",
        message: "OpenRouter requires an apiKey.",
        provider: "openrouter",
        model: candidate?.model,
        retryable: false,
      });
    }
  },
  async createModel(config) {
    return createOpenRouterModel(config);
  },
});

export const registerOpenRouterProvider = (): void => {
  globalProviderRegistry.set(createOpenRouterProvider());
};

const openRouterOptions: OpenAICompatibleProviderOptions = {
  id: "openrouter",
  displayName: "OpenRouter",
  baseURL: OPENROUTER_BASE_URL,
};

