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

const cloneTokenRecord = (record: TokenRecord): TokenRecord => ({
  ...record,
  scopes: record.scopes ? [...record.scopes] : undefined,
  metadata: record.metadata ? { ...record.metadata } : undefined,
});

export class MemoryTokenStore implements TokenStore {
  readonly #tokens = new Map<string, TokenRecord>();

  async get(key: string): Promise<TokenRecord | null> {
    const record = this.#tokens.get(key);
    return record ? cloneTokenRecord(record) : null;
  }

  async set(key: string, value: TokenRecord): Promise<void> {
    this.#tokens.set(key, cloneTokenRecord(value));
  }

  async delete(key: string): Promise<void> {
    this.#tokens.delete(key);
  }

  clear(): void {
    this.#tokens.clear();
  }
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
    validateProvider(provider);

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
    validateProvider(provider);
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requireOptionalString = (
  candidate: Record<string, unknown>,
  key: "apiKey" | "baseURL" | "auth",
): void => {
  if (candidate[key] === undefined) return;
  if (typeof candidate[key] === "string") return;

  throw new DocklineError({
    code: "INVALID_REQUEST",
    message: `Model config field "${key}" must be a string when provided.`,
    provider: typeof candidate.provider === "string" ? candidate.provider : undefined,
    model: typeof candidate.model === "string" ? candidate.model : undefined,
    retryable: false,
  });
};

const validateProvider = (provider: ModelProvider): void => {
  if (!provider || typeof provider !== "object") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Provider must be an object.",
      retryable: false,
    });
  }

  if (typeof provider.id !== "string" || provider.id.trim().length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Provider must include a non-empty id string.",
      retryable: false,
    });
  }

  if (typeof provider.createModel !== "function") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${provider.id}" must include a createModel function.`,
      provider: provider.id,
      retryable: false,
    });
  }
};

export function validateBaseModelConfig(config: unknown): asserts config is BaseModelConfig {
  if (!isPlainObject(config)) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must be an object.",
      retryable: false,
    });
  }

  const candidate = config as Record<string, unknown>;

  if (typeof candidate.provider !== "string" || candidate.provider.trim().length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must include a non-empty provider string.",
      retryable: false,
    });
  }

  if (typeof candidate.model !== "string" || candidate.model.trim().length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Model config must include a non-empty model string.",
      provider: candidate.provider,
      retryable: false,
    });
  }

  requireOptionalString(candidate, "apiKey");
  requireOptionalString(candidate, "baseURL");
  requireOptionalString(candidate, "auth");

  if (candidate.headers !== undefined) {
    if (!isPlainObject(candidate.headers)) {
      throw new DocklineError({
        code: "INVALID_REQUEST",
        message: "Model config field \"headers\" must be an object when provided.",
        provider: candidate.provider,
        model: candidate.model,
        retryable: false,
      });
    }

    for (const [name, value] of Object.entries(candidate.headers)) {
      if (typeof value !== "string") {
        throw new DocklineError({
          code: "INVALID_REQUEST",
          message: `Model config header "${name}" must be a string.`,
          provider: candidate.provider,
          model: candidate.model,
          retryable: false,
        });
      }
    }
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
