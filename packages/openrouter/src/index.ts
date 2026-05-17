import {
  DocklineError,
  globalProviderRegistry,
  type BaseModelConfig,
  type ModelDescriptor,
  type ModelProvider,
  type ProviderDiscoveryConfig,
  type TestConnectionResult,
} from "@dockline/core";
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
  return createOpenAICompatibleModel(
    {
      ...(config as OpenAICompatibleConfig),
      provider: "openrouter",
      baseURL: OPENROUTER_BASE_URL,
      headers: toOpenRouterHeaders(config),
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
  async testConnection(config) {
    return testOpenRouterConnection(config);
  },
  async listModels(config) {
    return listOpenRouterModels(config);
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

type OpenRouterDiscoveryConfig = ProviderDiscoveryConfig & Partial<OpenRouterConfig>;

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: unknown;
    name?: unknown;
  }>;
};

const toOpenRouterHeaders = (
  config: Pick<OpenRouterConfig, "apiKey" | "headers" | "appName" | "appURL">,
): Record<string, string> => {
  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (config.appName) headers["X-Title"] = config.appName;
  if (config.appURL) headers["HTTP-Referer"] = config.appURL;

  return headers;
};

const getApiKey = (
  config: Pick<BaseModelConfig, "apiKey"> & { model?: string },
): string => {
  if (typeof config.apiKey === "string" && config.apiKey.length > 0) return config.apiKey;

  throw new DocklineError({
    code: "AUTHENTICATION_ERROR",
    message: "OpenRouter requires an apiKey.",
    provider: "openrouter",
    model: config.model,
    retryable: false,
  });
};

const requestOpenRouterModels = async (
  config: OpenRouterDiscoveryConfig,
): Promise<Response> => {
  const apiKey = getApiKey(config);

  try {
    return await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...toOpenRouterHeaders({
          apiKey,
          headers: config.headers,
          appName: config.appName,
          appURL: config.appURL,
        }),
      },
    });
  } catch (error) {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: error instanceof Error ? error.message : "OpenRouter models request failed.",
      provider: "openrouter",
      model: config.model,
      retryable: true,
      originalError: error,
    });
  }
};

const listOpenRouterModels = async (
  config: OpenRouterDiscoveryConfig,
): Promise<ModelDescriptor[]> => {
  const response = await requestOpenRouterModels(config);

  if (!response.ok) {
    throw await toOpenRouterDiscoveryError(response, config.model);
  }

  const json = (await response.json()) as OpenRouterModelsResponse;

  if (!Array.isArray(json.data)) {
    throw new DocklineError({
      code: "UNKNOWN_ERROR",
      message: "OpenRouter models response did not include a data array.",
      provider: "openrouter",
      model: config.model,
      retryable: false,
    });
  }

  return json.data.flatMap((model): ModelDescriptor[] => {
    if (typeof model.id !== "string" || model.id.length === 0) return [];

    return [
      {
        id: model.id,
        displayName: typeof model.name === "string" ? model.name : undefined,
      },
    ];
  });
};

const testOpenRouterConnection = async (
  config: OpenRouterConfig,
): Promise<TestConnectionResult> => {
  const response = await requestOpenRouterModels(config);

  if (response.ok) {
    return {
      ok: true,
      status: "ok",
      provider: "openrouter",
      model: config.model,
    };
  }

  const message = await readOpenRouterErrorMessage(response);
  const unauthorized = response.status === 401 || response.status === 403;

  return {
    ok: false,
    status: unauthorized ? "unauthorized" : response.status >= 500 ? "unavailable" : "misconfigured",
    provider: "openrouter",
    model: config.model,
    message,
    retryable: response.status === 429 || response.status >= 500,
    details: { statusCode: response.status },
  };
};

const toOpenRouterDiscoveryError = async (
  response: Response,
  model?: string,
): Promise<DocklineError> =>
  new DocklineError({
    code: toOpenRouterErrorCode(response.status),
    message: await readOpenRouterErrorMessage(response),
    provider: "openrouter",
    model,
    statusCode: response.status,
    retryable: response.status === 429 || response.status >= 500,
  });

const readOpenRouterErrorMessage = async (response: Response): Promise<string> => {
  const body = await response.text();
  if (!body) return response.statusText;

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    const error = parsed.error;

    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const message = record.message ?? record.code ?? record.type;
      if (typeof message === "string") return message;
    }
  } catch {
    // Use the raw body as the message when it is not JSON.
  }

  return body;
};

const toOpenRouterErrorCode = (status: number) => {
  if (status === 401) return "AUTHENTICATION_ERROR";
  if (status === 403) return "AUTHORIZATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "INVALID_REQUEST";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN_ERROR";
};
