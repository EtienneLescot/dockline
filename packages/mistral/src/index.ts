import {
  DocklineError,
  globalProviderRegistry,
  type ModelCapabilities,
  type ModelProvider,
  type RuntimeOptionDescriptor,
} from "@dockline/core";
import {
  createLangChainChatProvider,
  type LangChainChatModelLike,
  type LangChainProviderConfig,
} from "@dockline/langchain-provider";

export type MistralConfig = LangChainProviderConfig & {
  provider: "mistral";
  apiKey: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type ChatMistralAIConstructor = new (
  fields: Record<string, unknown>,
) => LangChainChatModelLike;

export type MistralProviderOptions = {
  ChatMistralAI?: ChatMistralAIConstructor;
  capabilities?: Partial<ModelCapabilities>;
};

type MistralModule = {
  ChatMistralAI?: unknown;
};

export const mistral = (
  options: MistralProviderOptions = {},
): ModelProvider<MistralConfig> => createMistralProvider(options);

export const createMistralProvider = (
  options: MistralProviderOptions = {},
): ModelProvider<MistralConfig> =>
  createLangChainChatProvider<MistralConfig>({
    id: "mistral",
    displayName: "Mistral",
    metadata: {
      id: "mistral",
      displayName: "Mistral",
      backing: "langchain",
      authModes: ["api-key"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      runtimeOptions: mistralRuntimeOptions,
    },
    capabilities: options.capabilities,
    async createChatModel(config) {
      assertMistralConfig(config);
      const ChatMistralAI = options.ChatMistralAI ?? await loadChatMistralAI(config);
      return new ChatMistralAI(toChatMistralAIFields(config));
    },
  });

export const registerMistralProvider = (
  options?: MistralProviderOptions,
): void => {
  globalProviderRegistry.set(createMistralProvider(options));
};

const mistralRuntimeOptions: RuntimeOptionDescriptor[] = [
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
];

const assertMistralConfig: (config: unknown) => asserts config is MistralConfig = (config) => {
  const candidate = config as Partial<MistralConfig> | null;

  if (typeof candidate?.apiKey !== "string" || candidate.apiKey.length === 0) {
    throw new DocklineError({
      code: "AUTHENTICATION_ERROR",
      message: "Mistral requires an apiKey.",
      provider: "mistral",
      model: candidate?.model,
      retryable: false,
    });
  }
};

const toChatMistralAIFields = (config: MistralConfig): Record<string, unknown> =>
  stripUndefined({
    model: config.model,
    apiKey: config.apiKey,
    temperature: config.temperature,
    maxTokens: config.maxOutputTokens,
    maxOutputTokens: config.maxOutputTokens,
  });

const stripUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(value).flatMap(([key, item]): Array<[string, unknown]> =>
    item === undefined ? [] : [[key, item]],
  );

  return Object.fromEntries(entries);
};

const loadChatMistralAI = async (
  config: Pick<MistralConfig, "model">,
): Promise<ChatMistralAIConstructor> => {
  try {
    const module = await dynamicImport("@langchain/mistralai") as MistralModule;
    const ChatMistralAI = module.ChatMistralAI;

    if (typeof ChatMistralAI !== "function") {
      throw new Error("@langchain/mistralai did not export ChatMistralAI.");
    }

    return ChatMistralAI as ChatMistralAIConstructor;
  } catch (error) {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "Mistral provider requires @langchain/mistralai. Install it or pass a ChatMistralAI constructor override.",
      provider: "mistral",
      model: config.model,
      retryable: false,
      originalError: error,
    });
  }
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;
