import {
  DocklineError,
  globalProviderRegistry,
  type BaseModelConfig,
  type ModelCapabilities,
  type ModelProvider,
  type ProviderContext,
  type RuntimeOptionDescriptor,
} from "@dockline/core";
import {
  createLangChainChatProvider,
  type LangChainChatModelLike,
} from "@dockline/langchain-provider";

export type OpenAIReasoningEffort = "low" | "medium" | "high" | (string & {});

export type OpenAIConfig = BaseModelConfig & {
  provider: "openai";
  apiKey: string;
  organization?: string;
  project?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIReasoningEffort;
  capabilities?: Partial<ModelCapabilities>;
};

export type ChatOpenAIConstructor = new (
  fields: Record<string, unknown>,
) => LangChainChatModelLike;

export type OpenAIProviderOptions = {
  ChatOpenAI?: ChatOpenAIConstructor;
  capabilities?: Partial<ModelCapabilities>;
};

export const openai = (
  options: OpenAIProviderOptions = {},
): ModelProvider<OpenAIConfig> => createOpenAIProvider(options);

export const createOpenAIProvider = (
  options: OpenAIProviderOptions = {},
): ModelProvider<OpenAIConfig> =>
  createLangChainChatProvider<OpenAIConfig>({
    id: "openai",
    displayName: "OpenAI",
    metadata: {
      id: "openai",
      displayName: "OpenAI",
      backing: "langchain",
      authModes: ["api-key"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      runtimeOptions: openaiRuntimeOptions,
    },
    capabilities: {
      vision: true,
      ...options.capabilities,
    },
    async createChatModel(config, context) {
      assertOpenAIConfig(config);
      const ChatOpenAI = options.ChatOpenAI ?? await loadChatOpenAI(config, context);
      return new ChatOpenAI(toChatOpenAIFields(config));
    },
  });

export const createOpenAIProviderFactory = createOpenAIProvider;

export const registerOpenAIProvider = (
  options?: OpenAIProviderOptions,
): void => {
  globalProviderRegistry.set(createOpenAIProvider(options));
};

const openaiRuntimeOptions: RuntimeOptionDescriptor[] = [
  {
    id: "temperature",
    type: "number",
    displayName: "Temperature",
    category: "sampling",
    min: 0,
    max: 2,
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
  {
    id: "reasoningEffort",
    type: "enum",
    displayName: "Reasoning effort",
    category: "reasoning",
    enumValues: [
      { value: "low", displayName: "Low" },
      { value: "medium", displayName: "Medium" },
      { value: "high", displayName: "High" },
    ],
  },
];

const assertOpenAIConfig: (config: unknown) => asserts config is OpenAIConfig = (config) => {
  const candidate = config as Partial<OpenAIConfig> | null;

  if (typeof candidate?.apiKey !== "string" || candidate.apiKey.length === 0) {
    throw new DocklineError({
      code: "AUTHENTICATION_ERROR",
      message: "OpenAI requires an apiKey.",
      provider: "openai",
      model: candidate?.model,
      retryable: false,
    });
  }
};

const toChatOpenAIFields = (config: OpenAIConfig): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    model: config.model,
    apiKey: config.apiKey,
    temperature: config.temperature,
    maxTokens: config.maxOutputTokens,
    maxOutputTokens: config.maxOutputTokens,
    configuration: {
      baseURL: config.baseURL,
      organization: config.organization,
      project: config.project,
    },
    timeout: config.timeout,
    maxRetries: config.maxRetries,
  };

  if (config.reasoningEffort) {
    fields.reasoning = { effort: config.reasoningEffort };
  }

  return stripUndefined(fields);
};

const stripUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(value).flatMap(([key, item]): Array<[string, unknown]> => {
    if (item === undefined) return [];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const stripped = stripUndefined(item as Record<string, unknown>);
      return Object.keys(stripped).length > 0 ? [[key, stripped]] : [];
    }

    return [[key, item]];
  });

  return Object.fromEntries(entries);
};

const loadChatOpenAI = async (
  config: OpenAIConfig,
  _context?: ProviderContext,
): Promise<ChatOpenAIConstructor> => {
  try {
    const module = await dynamicImport("@langchain/openai");
    const ChatOpenAI = (module as { ChatOpenAI?: unknown }).ChatOpenAI;

    if (typeof ChatOpenAI !== "function") {
      throw new Error("@langchain/openai did not export ChatOpenAI.");
    }

    return ChatOpenAI as ChatOpenAIConstructor;
  } catch (error) {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "OpenAI provider requires @langchain/openai. Install it or pass a ChatOpenAI constructor override.",
      provider: "openai",
      model: config.model,
      retryable: false,
      originalError: error,
    });
  }
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;
