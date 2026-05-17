import {
  DocklineError,
  globalProviderRegistry,
  type BaseModelConfig,
  type ModelCapabilities,
  type ModelProvider,
  type RuntimeOptionDescriptor,
} from "@dockline/core";
import {
  createLangChainChatProvider,
  type LangChainChatModelLike,
} from "@dockline/langchain-provider";

export type GoogleConfig = BaseModelConfig & {
  provider: "google";
  apiKey: string;
  temperature?: number;
  maxOutputTokens?: number;
  capabilities?: Partial<ModelCapabilities>;
};

export type ChatGoogleGenerativeAIConstructor = new (
  fields: Record<string, unknown>,
) => LangChainChatModelLike;

export type GoogleProviderOptions = {
  ChatGoogleGenerativeAI?: ChatGoogleGenerativeAIConstructor;
  capabilities?: Partial<ModelCapabilities>;
};

type GoogleGenAIModule = {
  ChatGoogleGenerativeAI?: ChatGoogleGenerativeAIConstructor;
};

export const google = (
  options: GoogleProviderOptions = {},
): ModelProvider<GoogleConfig> => createGoogleProvider(options);

export const createGoogleProvider = (
  options: GoogleProviderOptions = {},
): ModelProvider<GoogleConfig> =>
  createLangChainChatProvider<GoogleConfig>({
    id: "google",
    displayName: "Google Gemini",
    metadata: {
      id: "google",
      displayName: "Google Gemini",
      backing: "langchain",
      authModes: ["api-key"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      runtimeOptions: googleRuntimeOptions,
    },
    capabilities: {
      vision: true,
      ...options.capabilities,
    },
    async createChatModel(config) {
      assertGoogleConfig(config);
      const ChatGoogleGenerativeAI =
        options.ChatGoogleGenerativeAI ?? await loadChatGoogleGenerativeAI(config);

      return new ChatGoogleGenerativeAI(toChatGoogleGenerativeAIFields(config));
    },
  });

export const registerGoogleProvider = (
  options: GoogleProviderOptions = {},
): void => {
  globalProviderRegistry.set(createGoogleProvider(options));
};

const googleRuntimeOptions: RuntimeOptionDescriptor[] = [
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
];

const assertGoogleConfig: (config: unknown) => asserts config is GoogleConfig = (config) => {
  const candidate = config as Partial<GoogleConfig> | null;

  if (typeof candidate?.apiKey !== "string" || candidate.apiKey.length === 0) {
    throw new DocklineError({
      code: "AUTHENTICATION_ERROR",
      message: "Google Gemini requires an apiKey.",
      provider: "google",
      model: candidate?.model,
      retryable: false,
    });
  }
};

const toChatGoogleGenerativeAIFields = (
  config: GoogleConfig,
): Record<string, unknown> => stripUndefined({
  model: config.model,
  apiKey: config.apiKey,
  temperature: config.temperature,
  maxOutputTokens: config.maxOutputTokens,
});

const stripUndefined = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const loadChatGoogleGenerativeAI = async (
  config: Pick<GoogleConfig, "model">,
): Promise<ChatGoogleGenerativeAIConstructor> => {
  let module: GoogleGenAIModule;

  try {
    module = await dynamicImport("@langchain/google-genai") as GoogleGenAIModule;
  } catch (error) {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "Install @langchain/google-genai to use the Google Gemini provider.",
      provider: "google",
      model: config.model,
      retryable: false,
      originalError: error,
    });
  }

  if (typeof module.ChatGoogleGenerativeAI !== "function") {
    throw new DocklineError({
      code: "PROVIDER_UNAVAILABLE",
      message: "@langchain/google-genai did not export ChatGoogleGenerativeAI.",
      provider: "google",
      model: config.model,
      retryable: false,
    });
  }

  return module.ChatGoogleGenerativeAI;
};

const dynamicImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<unknown>;
