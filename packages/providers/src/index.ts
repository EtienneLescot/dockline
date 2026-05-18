import {
  DocklineError,
  type BaseModelConfig,
  type ModelDescriptor,
  type ModelProvider,
  type ProviderAuthMode,
  type ProviderBacking,
  type ProviderDiscoveryConfig,
  type ProviderMetadata,
  type RuntimeOptionDescriptor,
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
  google as createGoogleProvider,
  type GoogleConfig,
  type GoogleProviderOptions,
} from "@dockline/google";
import {
  mistral as createMistralProvider,
  type MistralConfig,
  type MistralProviderOptions,
} from "@dockline/mistral";
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
  GoogleConfig,
  GoogleProviderOptions,
} from "@dockline/google";
export type {
  MistralConfig,
  MistralProviderOptions,
} from "@dockline/mistral";
export type {
  OpenAICompatibleConfig,
  OpenAICompatibleProviderOptions,
} from "@dockline/openai-compatible";
export type { OpenRouterConfig } from "@dockline/openrouter";

export type ProviderFactory<Config extends BaseModelConfig = BaseModelConfig> = () => ModelProvider<Config>;

export type PlannedProviderId =
  | "copilot"
  | "openai-oauth";

export type PlannedProviderOptions = {
  id?: PlannedProviderId;
  displayName?: string;
};

export type OpenAICompatiblePresetOptions = Omit<
  OpenAICompatibleProviderOptions,
  "id" | "displayName" | "baseURL"
> & {
  baseURL?: string;
};

export type DeepSeekConfig = OpenAICompatiblePresetConfig<"deepseek">;
export type MoonshotConfig = OpenAICompatiblePresetConfig<"moonshot">;
export type MiniMaxConfig = OpenAICompatiblePresetConfig<"minimax">;
export type AlibabaConfig = OpenAICompatiblePresetConfig<"alibaba">;

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
export const google = (
  options?: GoogleProviderOptions,
): ModelProvider<GoogleConfig> => createGoogleProvider(options);
export const anthropic = (
  options?: AnthropicProviderOptions,
): ModelProvider<AnthropicConfig> => createAnthropicProvider(options);
export const mistral = (
  options?: MistralProviderOptions,
): ModelProvider<MistralConfig> => createMistralProvider(options);
export const deepseek = (
  options?: OpenAICompatiblePresetOptions,
): ModelProvider<DeepSeekConfig> => openAICompatiblePreset({
  id: "deepseek",
  displayName: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  capabilities: { reasoning: true },
  runtimeOptions: deepSeekRuntimeOptions,
  options,
});
export const moonshot = (
  options?: OpenAICompatiblePresetOptions,
): ModelProvider<MoonshotConfig> => openAICompatiblePreset({
  id: "moonshot",
  displayName: "Moonshot AI / Kimi",
  baseURL: "https://api.moonshot.ai/v1",
  capabilities: { reasoning: true },
  runtimeOptions: moonshotRuntimeOptions,
  options,
});
export const minimax = (
  options?: OpenAICompatiblePresetOptions,
): ModelProvider<MiniMaxConfig> => openAICompatiblePreset({
  id: "minimax",
  displayName: "MiniMax",
  baseURL: "https://api.minimax.io/v1",
  capabilities: { reasoning: true },
  runtimeOptions: minimaxRuntimeOptions,
  options,
});
export const alibaba = (
  options?: OpenAICompatiblePresetOptions,
): ModelProvider<AlibabaConfig> => openAICompatiblePreset({
  id: "alibaba",
  displayName: "Alibaba/Qwen",
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  capabilities: { reasoning: true },
  runtimeOptions: alibabaRuntimeOptions,
  options,
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

type OpenAICompatiblePresetConfig<ProviderId extends string> = BaseModelConfig & {
  provider: ProviderId;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  capabilities?: OpenAICompatibleConfig["capabilities"];
};

type OpenAICompatiblePresetSpec = {
  id: "deepseek" | "moonshot" | "minimax" | "alibaba";
  displayName: string;
  baseURL: string;
  capabilities?: OpenAICompatibleProviderOptions["capabilities"];
  runtimeOptions?: RuntimeOptionDescriptor[];
  options?: OpenAICompatiblePresetOptions;
};

const openAICompatiblePreset = <ProviderId extends OpenAICompatiblePresetSpec["id"]>(
  spec: OpenAICompatiblePresetSpec & { id: ProviderId },
): ModelProvider<OpenAICompatiblePresetConfig<ProviderId>> => {
  const provider = createOpenAICompatibleProvider({
    ...spec.options,
    id: spec.id,
    displayName: spec.displayName,
    baseURL: spec.options?.baseURL ?? spec.baseURL,
    capabilities: {
      ...spec.capabilities,
      ...spec.options?.capabilities,
    },
  });

  return withMetadata(provider, {
    ...provider.metadata,
    id: spec.id,
    displayName: spec.displayName,
    backing: "openai-compatible",
    authModes: ["api-key"],
    supportsModelDiscovery: true,
    supportsConnectionTest: true,
    runtimeOptions: appendRuntimeOptions(provider.metadata?.runtimeOptions, spec.runtimeOptions),
  }) as unknown as ModelProvider<OpenAICompatiblePresetConfig<ProviderId>>;
};

const appendRuntimeOptions = (
  baseOptions: RuntimeOptionDescriptor[] | undefined,
  extraOptions: RuntimeOptionDescriptor[] | undefined,
): RuntimeOptionDescriptor[] | undefined => {
  if (!extraOptions || extraOptions.length === 0) return baseOptions;
  return [...(baseOptions ?? []), ...extraOptions];
};

const thinkingTypeRuntimeOption = (
  description: string,
): RuntimeOptionDescriptor => ({
  id: "providerOptions.thinking.type",
  type: "enum",
  displayName: "Thinking mode",
  description,
  category: "reasoning",
  enumValues: [
    { value: "enabled", displayName: "Enabled" },
    { value: "disabled", displayName: "Disabled" },
  ],
});

const deepSeekRuntimeOptions: RuntimeOptionDescriptor[] = [
  thinkingTypeRuntimeOption("DeepSeek OpenAI-compatible thinking mode toggle."),
  {
    id: "providerOptions.reasoning_effort",
    type: "enum",
    displayName: "Reasoning effort",
    description: "DeepSeek thinking effort for OpenAI-compatible requests.",
    category: "reasoning",
    enumValues: [
      { value: "high", displayName: "High" },
      { value: "max", displayName: "Max" },
    ],
  },
];

const moonshotRuntimeOptions: RuntimeOptionDescriptor[] = [
  thinkingTypeRuntimeOption("Moonshot/Kimi thinking mode toggle for supported Kimi models."),
];

const minimaxRuntimeOptions: RuntimeOptionDescriptor[] = [
  {
    id: "providerOptions.reasoning_split",
    type: "boolean",
    displayName: "Reasoning split",
    description: "MiniMax interleaved-thinking format that separates reasoning into reasoning_details.",
    category: "reasoning",
  },
];

const alibabaRuntimeOptions: RuntimeOptionDescriptor[] = [
  {
    id: "providerOptions.enable_thinking",
    type: "boolean",
    displayName: "Enable thinking",
    description: "Alibaba/Qwen OpenAI-compatible thinking mode toggle for supported models.",
    category: "reasoning",
  },
];

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
