import { DocklineError } from "./errors.js";
import type { UniversalChatModel } from "./model.js";

export type BaseModelConfig = {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  auth?: "api-key" | "oauth" | "device-code" | "environment" | string;
  [key: string]: unknown;
};

export type ModelDescriptor = {
  id: string;
  displayName?: string;
  capabilities?: Partial<UniversalChatModel["capabilities"]>;
};

export type ProviderContext = {
  tokenStore?: TokenStore;
};

export interface TokenRecord {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface TokenStore {
  get(key: string): Promise<TokenRecord | null>;
  set(key: string, value: TokenRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ModelProvider<Config extends BaseModelConfig = BaseModelConfig> {
  id: string;
  displayName?: string;
  createModel(config: Config, context?: ProviderContext): Promise<UniversalChatModel>;
  listModels?(context?: ProviderContext): Promise<ModelDescriptor[]>;
  validateConfig?(config: unknown): asserts config is Config;
}

export class ProviderRegistry {
  readonly #providers = new Map<string, ModelProvider>();

  register(provider: ModelProvider): void {
    if (this.#providers.has(provider.id)) {
      throw new DocklineError({
        code: "INVALID_REQUEST",
        message: `Provider "${provider.id}" is already registered.`,
        provider: provider.id,
        retryable: false,
      });
    }

    this.#providers.set(provider.id, provider);
  }

  set(provider: ModelProvider): void {
    this.#providers.set(provider.id, provider);
  }

  get(id: string): ModelProvider | undefined {
    return this.#providers.get(id);
  }

  list(): ModelProvider[] {
    return [...this.#providers.values()];
  }

  clear(): void {
    this.#providers.clear();
  }
}

export const globalProviderRegistry = new ProviderRegistry();

export function validateBaseModelConfig(config: unknown): asserts config is BaseModelConfig {
  if (!config || typeof config !== "object") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must be an object.",
      retryable: false,
    });
  }

  const candidate = config as Record<string, unknown>;

  if (typeof candidate.provider !== "string" || candidate.provider.length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must include a provider string.",
      retryable: false,
    });
  }

  if (typeof candidate.model !== "string" || candidate.model.length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must include a model string.",
      provider: candidate.provider,
      retryable: false,
    });
  }
}

export const createModel = async (
  config: BaseModelConfig,
  context?: ProviderContext,
  registry = globalProviderRegistry,
): Promise<UniversalChatModel> => {
  validateBaseModelConfig(config);

  const provider = registry.get(config.provider);

  if (!provider) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${config.provider}" is not registered.`,
      provider: config.provider,
      model: config.model,
      retryable: false,
    });
  }

  const validateConfig: ((value: unknown) => void) | undefined = provider.validateConfig;
  validateConfig?.(config);
  return provider.createModel(config, context);
};

export const listProviders = (registry = globalProviderRegistry): ModelProvider[] => registry.list();
