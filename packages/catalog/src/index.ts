import type { ProviderAuthMode, ProviderBacking } from "@dockline/core";

export type CatalogSourceId = "ai-sdk" | "langchain" | "dockline-native";

export type CatalogSourceKind = "primary" | "complement" | "native";

export type ProviderKind =
  | "api-provider"
  | "gateway"
  | "local-runtime"
  | "account-backed"
  | "agent-runtime"
  | "protocol"
  | "observability";

export type ProviderCatalogStatus =
  | "available-upstream"
  | "planned-native"
  | "experimental-upstream";

export type CapabilityGroup =
  | "language"
  | "embeddings"
  | "image"
  | "audio"
  | "video"
  | "tools"
  | "agent-runtime";

export type ProviderCatalogSource = {
  id: CatalogSourceId;
  kind: CatalogSourceKind;
  upstreamId?: string;
  packageName?: string;
  notes?: string;
};

export type ProviderCatalogEntry = {
  id: string;
  displayName: string;
  aliases?: string[];
  providerKind: ProviderKind;
  authModes: ProviderAuthMode[];
  sources: ProviderCatalogSource[];
  recommendedBacking: ProviderBacking;
  availableBackings: ProviderBacking[];
  capabilityGroups: CapabilityGroup[];
  status: ProviderCatalogStatus;
  userSelectable: boolean;
  notes?: string;
};

export type ProviderCatalogFilter = {
  source?: CatalogSourceId;
  providerKind?: ProviderKind;
  authMode?: ProviderAuthMode;
  backing?: ProviderBacking;
  includeHidden?: boolean;
};

type EntryOptions = Omit<ProviderCatalogEntry, "sources" | "userSelectable"> & {
  sources?: ProviderCatalogSource[];
  userSelectable?: boolean;
};

const aiSdkSource = (
  upstreamId: string,
  packageName?: string,
  notes?: string,
): ProviderCatalogSource => ({
  id: "ai-sdk",
  kind: "primary",
  upstreamId,
  packageName,
  notes,
});

const langChainSource = (
  upstreamId: string,
  packageName?: string,
  notes?: string,
): ProviderCatalogSource => ({
  id: "langchain",
  kind: "complement",
  upstreamId,
  packageName,
  notes,
});

const docklineNativeSource = (
  upstreamId: string,
  notes?: string,
): ProviderCatalogSource => ({
  id: "dockline-native",
  kind: "native",
  upstreamId,
  notes,
});

const entry = (options: EntryOptions): ProviderCatalogEntry => ({
  ...options,
  sources: options.sources ?? [],
  userSelectable: options.userSelectable ?? true,
});

const aiSdk = (
  id: string,
  displayName: string,
  packageName: string | undefined,
  options: Partial<EntryOptions> = {},
): ProviderCatalogEntry => entry({
  id,
  displayName,
  providerKind: "api-provider",
  authModes: ["api-key"],
  sources: [aiSdkSource(displayName, packageName)],
  recommendedBacking: "vercel-ai-sdk",
  availableBackings: ["vercel-ai-sdk"],
  capabilityGroups: ["language"],
  status: "available-upstream",
  ...options,
});

const langchainComplement = (
  id: string,
  displayName: string,
  options: Partial<EntryOptions> = {},
): ProviderCatalogEntry => entry({
  id,
  displayName,
  providerKind: "api-provider",
  authModes: ["api-key"],
  sources: [langChainSource(displayName)],
  recommendedBacking: "langchain",
  availableBackings: ["langchain"],
  capabilityGroups: ["language"],
  status: "available-upstream",
  ...options,
});

const nativePlanned = (
  id: string,
  displayName: string,
  options: Partial<EntryOptions> = {},
): ProviderCatalogEntry => entry({
  id,
  displayName,
  providerKind: "account-backed",
  authModes: ["oauth", "device-code"],
  sources: [docklineNativeSource(displayName)],
  recommendedBacking: "native",
  availableBackings: ["native"],
  capabilityGroups: ["language"],
  status: "planned-native",
  ...options,
});

export const providerCatalog = [
  aiSdk("vercel-ai-gateway", "Vercel AI Gateway", "@ai-sdk/gateway", {
    providerKind: "gateway",
    aliases: ["vercel-gateway", "ai-gateway"],
    notes: "Gateway provider. Users authenticate with Vercel AI Gateway, not with the routed upstream model provider.",
  }),
  aiSdk("vercel-v0", "Vercel / v0", "@ai-sdk/vercel", {
    aliases: ["v0"],
  }),
  aiSdk("openai", "OpenAI", "@ai-sdk/openai", {
    sources: [
      aiSdkSource("OpenAI", "@ai-sdk/openai"),
      langChainSource("OpenAI", "@langchain/openai"),
    ],
  }),
  aiSdk("azure-openai", "Azure OpenAI", "@ai-sdk/azure", {
    sources: [
      aiSdkSource("Azure OpenAI", "@ai-sdk/azure"),
      langChainSource("Azure OpenAI", "@langchain/openai"),
    ],
  }),
  aiSdk("anthropic", "Anthropic", "@ai-sdk/anthropic", {
    sources: [
      aiSdkSource("Anthropic", "@ai-sdk/anthropic"),
      langChainSource("Anthropic", "@langchain/anthropic"),
    ],
  }),
  aiSdk("amazon-bedrock", "Amazon Bedrock", "@ai-sdk/amazon-bedrock", {
    aliases: ["aws-bedrock", "bedrock"],
    sources: [
      aiSdkSource("Amazon Bedrock", "@ai-sdk/amazon-bedrock"),
      langChainSource("Amazon Bedrock"),
    ],
  }),
  aiSdk("google", "Google Generative AI / Gemini", "@ai-sdk/google", {
    aliases: ["gemini", "google-gemini"],
    sources: [
      aiSdkSource("Google Generative AI", "@ai-sdk/google"),
      langChainSource("Google Gemini", "@langchain/google-genai"),
    ],
  }),
  aiSdk("google-vertex", "Google Vertex AI", "@ai-sdk/google-vertex", {
    aliases: ["vertex-ai"],
  }),
  aiSdk("xai", "xAI / Grok", "@ai-sdk/xai", {
    aliases: ["grok"],
    sources: [
      aiSdkSource("xAI Grok", "@ai-sdk/xai"),
      langChainSource("xAI"),
    ],
  }),
  aiSdk("mistral", "Mistral AI", "@ai-sdk/mistral", {
    sources: [
      aiSdkSource("Mistral AI", "@ai-sdk/mistral"),
      langChainSource("Mistral", "@langchain/mistralai"),
    ],
  }),
  aiSdk("together-ai", "Together.ai", "@ai-sdk/togetherai", {
    aliases: ["together"],
    sources: [
      aiSdkSource("Together.ai", "@ai-sdk/togetherai"),
      langChainSource("Together AI"),
    ],
  }),
  aiSdk("cohere", "Cohere", "@ai-sdk/cohere", {
    sources: [
      aiSdkSource("Cohere", "@ai-sdk/cohere"),
      langChainSource("Cohere"),
    ],
  }),
  aiSdk("fireworks", "Fireworks", "@ai-sdk/fireworks", {
    sources: [
      aiSdkSource("Fireworks", "@ai-sdk/fireworks"),
      langChainSource("Fireworks"),
    ],
  }),
  aiSdk("deepinfra", "DeepInfra", "@ai-sdk/deepinfra", {
    aliases: ["deep-infra"],
    sources: [
      aiSdkSource("DeepInfra", "@ai-sdk/deepinfra"),
      langChainSource("Deep Infra"),
    ],
  }),
  aiSdk("deepseek", "DeepSeek", "@ai-sdk/deepseek", {
    sources: [
      aiSdkSource("DeepSeek", "@ai-sdk/deepseek"),
      langChainSource("DeepSeek"),
    ],
  }),
  aiSdk("cerebras", "Cerebras", "@ai-sdk/cerebras", {
    sources: [
      aiSdkSource("Cerebras", "@ai-sdk/cerebras"),
      langChainSource("Cerebras"),
    ],
  }),
  aiSdk("groq", "Groq", "@ai-sdk/groq", {
    sources: [
      aiSdkSource("Groq", "@ai-sdk/groq"),
      langChainSource("Groq"),
    ],
  }),
  aiSdk("perplexity", "Perplexity", "@ai-sdk/perplexity", {
    sources: [
      aiSdkSource("Perplexity", "@ai-sdk/perplexity"),
      langChainSource("Perplexity"),
    ],
  }),
  aiSdk("moonshot", "Moonshot AI", "@ai-sdk/moonshot", {
    aliases: ["kimi", "moonshotai"],
    sources: [
      aiSdkSource("Moonshot AI", "@ai-sdk/moonshot"),
      langChainSource("Moonshot"),
    ],
  }),
  aiSdk("alibaba", "Alibaba / Qwen", "@ai-sdk/alibaba", {
    aliases: ["qwen", "dashscope", "alibaba-tongyi"],
    sources: [
      aiSdkSource("Alibaba", "@ai-sdk/alibaba"),
      langChainSource("Alibaba Tongyi"),
    ],
  }),
  aiSdk("hugging-face", "Hugging Face", "@ai-sdk/huggingface"),
  aiSdk("nvidia-nim", "NVIDIA NIM", "@ai-sdk/nvidia", {
    aliases: ["nvidia"],
  }),
  aiSdk("clarifai", "Clarifai", "@ai-sdk/clarifai"),
  aiSdk("baseten", "Baseten", "@ai-sdk/baseten"),
  aiSdk("openai-compatible", "OpenAI-compatible endpoint", "@ai-sdk/openai-compatible", {
    providerKind: "gateway",
    aliases: ["openai-compatible-api"],
    sources: [
      aiSdkSource("OpenAI Compatible Providers", "@ai-sdk/openai-compatible"),
      docklineNativeSource("OpenAI-compatible", "Dockline owns a native tested OpenAI-compatible transport."),
    ],
    recommendedBacking: "openai-compatible",
    availableBackings: ["openai-compatible", "vercel-ai-sdk"],
  }),
  aiSdk("lm-studio", "LM Studio", undefined, {
    providerKind: "local-runtime",
    sources: [aiSdkSource("LM Studio", undefined, "OpenAI-compatible local runtime.")],
    recommendedBacking: "openai-compatible",
    availableBackings: ["openai-compatible", "vercel-ai-sdk"],
  }),
  aiSdk("heroku", "Heroku", undefined),
  aiSdk("ollama", "Ollama", "ollama-ai-provider", {
    providerKind: "local-runtime",
    sources: [
      aiSdkSource("Ollama", "ollama-ai-provider"),
      langChainSource("Ollama"),
    ],
  }),
  aiSdk("friendliai", "FriendliAI", "@friendliai/ai-provider", {
    aliases: ["friendli"],
    sources: [
      aiSdkSource("FriendliAI", "@friendliai/ai-provider"),
      langChainSource("Friendli"),
    ],
  }),
  aiSdk("portkey", "Portkey", "@portkey-ai/vercel-provider", {
    providerKind: "gateway",
  }),
  aiSdk("cloudflare-workers-ai", "Cloudflare Workers AI", "workers-ai-provider", {
    sources: [
      aiSdkSource("Cloudflare Workers AI", "workers-ai-provider"),
      langChainSource("Cloudflare Workers AI"),
    ],
  }),
  aiSdk("openrouter", "OpenRouter", "@openrouter/ai-sdk-provider", {
    providerKind: "gateway",
    sources: [
      aiSdkSource("OpenRouter", "@openrouter/ai-sdk-provider"),
      langChainSource("OpenRouter"),
      docklineNativeSource("OpenRouter", "Dockline owns a native OpenRouter provider built on OpenAI-compatible transport."),
    ],
    recommendedBacking: "gateway",
    availableBackings: ["gateway", "vercel-ai-sdk", "langchain"],
  }),
  aiSdk("apertis", "Apertis", "@apertis/ai-sdk-provider"),
  aiSdk("aihubmix", "Aihubmix", "@aihubmix/ai-sdk-provider", {
    providerKind: "gateway",
  }),
  aiSdk("requesty", "Requesty", "@requesty/ai-sdk", {
    providerKind: "gateway",
  }),
  aiSdk("crosshatch", "Crosshatch", "@crosshatch/ai-provider"),
  aiSdk("mixedbread", "Mixedbread", "mixedbread-ai-provider", {
    capabilityGroups: ["embeddings"],
  }),
  aiSdk("voyage-ai", "Voyage AI", "voyage-ai-provider", {
    aliases: ["voyage"],
    capabilityGroups: ["embeddings"],
  }),
  aiSdk("mem0", "Mem0", "@mem0/vercel-ai-provider"),
  aiSdk("letta", "Letta", "@letta-ai/vercel-ai-sdk-provider", {
    providerKind: "agent-runtime",
    capabilityGroups: ["agent-runtime"],
  }),
  aiSdk("hindsight", "Hindsight", "@vectorize-io/hindsight-ai-sdk"),
  aiSdk("supermemory", "Supermemory", "@supermemory/tools"),
  aiSdk("spark", "Spark", "spark-ai-provider"),
  aiSdk("anthropic-vertex", "Anthropic Vertex", "anthropic-vertex-ai"),
  aiSdk("langdb", "LangDB", "@langdb/vercel-provider", {
    providerKind: "gateway",
  }),
  aiSdk("dify", "Dify", "dify-ai-provider", {
    providerKind: "gateway",
  }),
  aiSdk("sarvam", "Sarvam", "sarvam-ai-provider"),
  aiSdk("claude-code", "Claude Code", "ai-sdk-provider-claude-code", {
    providerKind: "agent-runtime",
    authModes: ["environment", "custom"],
    capabilityGroups: ["agent-runtime", "tools"],
    status: "experimental-upstream",
  }),
  aiSdk("browser-ai", "Browser AI", "browser-ai", {
    providerKind: "local-runtime",
    authModes: ["environment"],
  }),
  aiSdk("gemini-cli", "Gemini CLI", "ai-sdk-provider-gemini-cli", {
    providerKind: "agent-runtime",
    authModes: ["environment", "custom"],
    capabilityGroups: ["agent-runtime"],
    status: "experimental-upstream",
  }),
  aiSdk("a2a", "A2A", "a2a-ai-provider", {
    providerKind: "protocol",
    authModes: ["custom"],
    capabilityGroups: ["agent-runtime"],
    status: "experimental-upstream",
  }),
  aiSdk("sap-ai-core", "SAP AI Core", "@mymediset/sap-ai-provider", {
    aliases: ["sap-ai"],
  }),
  aiSdk("aiml-api", "AI/ML API", "@ai-ml.api/aimlapi-vercel-ai", {
    aliases: ["ai-ml-api"],
    providerKind: "gateway",
  }),
  aiSdk("mcp-sampling", "MCP Sampling", "@mcpc-tech/mcp-sampling-ai-provider", {
    providerKind: "protocol",
    authModes: ["environment", "custom"],
    status: "experimental-upstream",
  }),
  aiSdk("acp", "ACP", "@mcpc-tech/acp-ai-provider", {
    providerKind: "protocol",
    authModes: ["environment", "custom"],
    status: "experimental-upstream",
  }),
  aiSdk("opencode", "OpenCode", "ai-sdk-provider-opencode-sdk", {
    providerKind: "agent-runtime",
    authModes: ["environment", "custom"],
    capabilityGroups: ["agent-runtime"],
    status: "experimental-upstream",
  }),
  aiSdk("codex-cli", "Codex CLI", "ai-sdk-provider-codex-cli", {
    providerKind: "agent-runtime",
    authModes: ["environment", "custom"],
    sources: [
      aiSdkSource("Codex CLI", "ai-sdk-provider-codex-cli"),
      docklineNativeSource("Codex CLI", "Native Dockline runtime support remains planned for official/documented flows."),
    ],
    recommendedBacking: "vercel-ai-sdk",
    availableBackings: ["vercel-ai-sdk", "native"],
    capabilityGroups: ["agent-runtime", "tools"],
    status: "experimental-upstream",
  }),
  aiSdk("soniox", "Soniox", "@soniox/vercel-ai-sdk-provider", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("zai", "Zhipu / Z.AI", "zhipu-ai-provider", {
    aliases: ["zhipu", "zhipuai"],
    sources: [
      aiSdkSource("Zhipu (Z.AI)", "zhipu-ai-provider"),
      langChainSource("ZhipuAI"),
    ],
  }),
  aiSdk("ollm", "OLLM", "@ofoundation/ollm", {
    providerKind: "local-runtime",
  }),
  aiSdk("fal", "Fal", "@ai-sdk/fal", {
    capabilityGroups: ["image", "video"],
  }),
  aiSdk("black-forest-labs", "Black Forest Labs", "@ai-sdk/black-forest-labs", {
    aliases: ["bfl"],
    capabilityGroups: ["image"],
  }),
  aiSdk("replicate", "Replicate", "@ai-sdk/replicate", {
    capabilityGroups: ["image", "video", "language"],
  }),
  aiSdk("prodia", "Prodia", "@ai-sdk/prodia", {
    capabilityGroups: ["image"],
  }),
  aiSdk("luma", "Luma AI", "@ai-sdk/luma", {
    capabilityGroups: ["video", "image"],
  }),
  aiSdk("bytedance", "ByteDance", "@ai-sdk/bytedance", {
    capabilityGroups: ["image", "video", "language"],
  }),
  aiSdk("kling-ai", "Kling AI", "@ai-sdk/kling", {
    aliases: ["kling"],
    capabilityGroups: ["video", "image"],
  }),
  aiSdk("elevenlabs", "ElevenLabs", "@ai-sdk/elevenlabs", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("assemblyai", "AssemblyAI", "@ai-sdk/assemblyai", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("deepgram", "Deepgram", "@ai-sdk/deepgram", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("gladia", "Gladia", "@ai-sdk/gladia", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("lmnt", "LMNT", "@ai-sdk/lmnt", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("hume", "Hume", "@ai-sdk/hume", {
    capabilityGroups: ["audio"],
  }),
  aiSdk("revai", "Rev.ai", "@ai-sdk/revai", {
    capabilityGroups: ["audio"],
  }),

  langchainComplement("arcjet", "Arcjet", {
    providerKind: "observability",
    capabilityGroups: ["language", "tools"],
  }),
  langchainComplement("baidu-qianfan", "Baidu Qianfan"),
  langchainComplement("baidu-wenxin", "Baidu Wenxin"),
  langchainComplement("ibm", "IBM"),
  langchainComplement("neural-internet-bittensor", "Neural Internet Bittensor", {
    aliases: ["bittensor"],
  }),
  langchainComplement("novita", "Novita"),
  langchainComplement("ollama-functions", "Ollama Functions", {
    providerKind: "local-runtime",
    authModes: ["environment"],
  }),
  langchainComplement("premai", "PremAI"),
  langchainComplement("promptlayer-openai", "PromptLayer OpenAI", {
    providerKind: "observability",
  }),
  langchainComplement("tencent-hunyuan", "Tencent Hunyuan"),
  langchainComplement("webllm", "WebLLM", {
    providerKind: "local-runtime",
    authModes: ["environment"],
  }),
  langchainComplement("yandex", "Yandex"),

  nativePlanned("openai-chatgpt-account", "OpenAI ChatGPT account", {
    aliases: ["chatgpt", "openai-oauth"],
    authModes: ["oauth", "device-code"],
    notes: "Account-backed ChatGPT/Codex access must use official/documented flows only. No token scraping or private endpoints.",
  }),
  nativePlanned("github-copilot", "GitHub Copilot", {
    aliases: ["copilot"],
    authModes: ["device-code", "environment"],
    capabilityGroups: ["language", "agent-runtime", "tools"],
    notes: "Native Dockline connector target for official GitHub Copilot device flow or SDK-delegated auth.",
  }),
  nativePlanned("vscode-lm", "VS Code LM API", {
    authModes: ["environment"],
    providerKind: "account-backed",
    notes: "Environment-provided model access inside VS Code-compatible hosts.",
  }),
] as const satisfies readonly ProviderCatalogEntry[];

export type ProviderCatalogId = typeof providerCatalog[number]["id"];

export const listCatalogProviders = (
  filter: ProviderCatalogFilter = {},
): ProviderCatalogEntry[] =>
  providerCatalog
    .filter((provider) => filter.includeHidden || provider.userSelectable)
    .filter((provider) => !filter.source || provider.sources.some((source) => source.id === filter.source))
    .filter((provider) => !filter.providerKind || provider.providerKind === filter.providerKind)
    .filter((provider) => !filter.authMode || provider.authModes.includes(filter.authMode))
    .filter((provider) => !filter.backing || provider.availableBackings.includes(filter.backing))
    .map(cloneEntry);

export const getCatalogProvider = (idOrAlias: string): ProviderCatalogEntry | undefined => {
  const normalized = normalizeProviderId(idOrAlias);
  const provider = providerCatalog.find((entry) =>
    normalizeProviderId(entry.id) === normalized ||
    entry.aliases?.some((alias) => normalizeProviderId(alias) === normalized)
  );

  return provider ? cloneEntry(provider) : undefined;
};

export const requireCatalogProvider = (idOrAlias: string): ProviderCatalogEntry => {
  const provider = getCatalogProvider(idOrAlias);
  if (!provider) {
    throw new Error(`Unknown Dockline catalog provider "${idOrAlias}".`);
  }

  return provider;
};

export const listCatalogProviderIds = (
  filter: ProviderCatalogFilter = {},
): string[] => listCatalogProviders(filter).map((provider) => provider.id);

const normalizeProviderId = (id: string): string =>
  id.trim().toLowerCase().replace(/[_\s/]+/g, "-");

const cloneEntry = (provider: ProviderCatalogEntry): ProviderCatalogEntry => ({
  ...provider,
  aliases: provider.aliases ? [...provider.aliases] : undefined,
  authModes: [...provider.authModes],
  sources: provider.sources.map((source) => ({ ...source })),
  availableBackings: [...provider.availableBackings],
  capabilityGroups: [...provider.capabilityGroups],
});
