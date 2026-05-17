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

export type ProviderDiscoveryConfig = {
  provider: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  auth?: "api-key" | "oauth" | "device-code" | "environment" | string;
  [key: string]: unknown;
};

export type ModelDescriptor = {
  id: string;
  provider?: string;
  displayName?: string;
  capabilities?: Partial<UniversalChatModel["capabilities"]>;
};

export type ProviderAuthMode =
  | "api-key"
  | "oauth"
  | "device-code"
  | "environment"
  | "custom"
  | (string & {});

export type ProviderBacking =
  | "native"
  | "langchain"
  | "vercel-ai-sdk"
  | "openai-compatible"
  | "gateway"
  | "custom"
  | (string & {});

export type RuntimeOptionValue = string | number | boolean;

export type RuntimeOptionDescriptor = {
  id: string;
  type: "boolean" | "string" | "number" | "integer" | "enum";
  displayName?: string;
  description?: string;
  category?: "reasoning" | "sampling" | "output" | "provider-specific" | (string & {});
  required?: boolean;
  defaultValue?: RuntimeOptionValue;
  enumValues?: Array<{
    value: RuntimeOptionValue;
    displayName?: string;
    description?: string;
  }>;
  min?: number;
  max?: number;
  step?: number;
};

export type ReasoningOptionDescriptor = RuntimeOptionDescriptor & {
  category: "reasoning";
};

export type ProviderMetadata = {
  id: string;
  displayName: string;
  description?: string;
  backing?: ProviderBacking;
  authModes: ProviderAuthMode[];
  supportsModelDiscovery: boolean;
  supportsConnectionTest: boolean;
  runtimeOptions?: RuntimeOptionDescriptor[];
};

export type TestConnectionStatus =
  | "ok"
  | "unauthorized"
  | "misconfigured"
  | "unavailable"
  | "unsupported";

export type TestConnectionResult = {
  ok: boolean;
  status: TestConnectionStatus;
  provider: string;
  model?: string;
  message?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
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
  metadata?: Partial<ProviderMetadata>;
  createModel(config: Config, context?: ProviderContext): Promise<UniversalChatModel>;
  testConnection?(config: Config, context?: ProviderContext): Promise<TestConnectionResult>;
  listModels?(
    config: ProviderDiscoveryConfig & Partial<Config>,
    context?: ProviderContext,
  ): Promise<ModelDescriptor[]>;
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

  if (provider.testConnection !== undefined && typeof provider.testConnection !== "function") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${provider.id}" testConnection must be a function when provided.`,
      provider: provider.id,
      retryable: false,
    });
  }

  if (provider.listModels !== undefined && typeof provider.listModels !== "function") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${provider.id}" listModels must be a function when provided.`,
      provider: provider.id,
      retryable: false,
    });
  }

  if (provider.metadata !== undefined && !isPlainObject(provider.metadata)) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${provider.id}" metadata must be an object when provided.`,
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

export function validateProviderDiscoveryConfig(
  config: unknown,
): asserts config is ProviderDiscoveryConfig {
  if (!isPlainObject(config)) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Provider discovery config must be an object.",
      retryable: false,
    });
  }

  const candidate = config as Record<string, unknown>;

  if (typeof candidate.provider !== "string" || candidate.provider.trim().length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Provider discovery config must include a non-empty provider string.",
      retryable: false,
    });
  }

  if (
    candidate.model !== undefined &&
    (typeof candidate.model !== "string" || candidate.model.trim().length === 0)
  ) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Provider discovery config field \"model\" must be a non-empty string when provided.",
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
        message: "Provider discovery config field \"headers\" must be an object when provided.",
        provider: candidate.provider,
        model: typeof candidate.model === "string" ? candidate.model : undefined,
        retryable: false,
      });
    }

    for (const [name, value] of Object.entries(candidate.headers)) {
      if (typeof value !== "string") {
        throw new DocklineError({
          code: "INVALID_REQUEST",
          message: `Provider discovery config header "${name}" must be a string.`,
          provider: candidate.provider,
          model: typeof candidate.model === "string" ? candidate.model : undefined,
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

export const testProviderConnection = async (
  config: BaseModelConfig,
  context?: ProviderContext,
  registry = globalProviderRegistry,
): Promise<TestConnectionResult> => {
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

  if (!provider.testConnection) {
    return {
      ok: false,
      status: "unsupported",
      provider: config.provider,
      model: config.model,
      message: `Provider "${config.provider}" does not implement testConnection.`,
      retryable: false,
    };
  }

  const result = await provider.testConnection(config, context);

  return {
    ...result,
    provider: result.provider || config.provider,
    model: result.model || config.model,
  };
};

export const listProviderModels = async (
  config: ProviderDiscoveryConfig,
  context?: ProviderContext,
  registry = globalProviderRegistry,
): Promise<ModelDescriptor[]> => {
  validateProviderDiscoveryConfig(config);

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

  if (!provider.listModels) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Provider "${config.provider}" does not implement listModels.`,
      provider: config.provider,
      model: config.model,
      retryable: false,
    });
  }

  const models = await provider.listModels(config, context);

  return models.map((model) => ({
    ...model,
    provider: model.provider || config.provider,
  }));
};

export const listProviders = (registry = globalProviderRegistry): ModelProvider[] => registry.list();

export const getProviderMetadata = (provider: ModelProvider): ProviderMetadata => {
  const metadata = provider.metadata ?? {};

  return {
    ...metadata,
    id: provider.id,
    displayName: metadata.displayName || provider.displayName || provider.id,
    authModes: metadata.authModes ? [...metadata.authModes] : [],
    supportsModelDiscovery: metadata.supportsModelDiscovery ?? Boolean(provider.listModels),
    supportsConnectionTest: metadata.supportsConnectionTest ?? Boolean(provider.testConnection),
    runtimeOptions: metadata.runtimeOptions
      ? metadata.runtimeOptions.map((option) => ({
          ...option,
          enumValues: option.enumValues
            ? option.enumValues.map((enumValue) => ({ ...enumValue }))
            : undefined,
        }))
      : undefined,
  };
};

export const listProviderMetadata = (
  registry = globalProviderRegistry,
): ProviderMetadata[] => registry.list().map(getProviderMetadata);

export const listAvailableProviders = (
  registry = globalProviderRegistry,
): ProviderMetadata[] => listProviderMetadata(registry);
