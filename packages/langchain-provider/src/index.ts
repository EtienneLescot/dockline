import {
  chatModelCapabilities,
  globalProviderRegistry,
  type BaseModelConfig,
  type GenerateInput,
  type GenerateResult,
  type MessageContent,
  type ModelCapabilities,
  type ModelEvent,
  type ModelMessage,
  type ModelProvider,
  type ProviderContext,
  type ProviderMetadata,
  type StructuredOutputMode,
  type TokenUsage,
  type ToolCall,
  type ToolCallingMode,
  type ToolDefinition,
  type UniversalChatModel,
} from "@dockline/core";

export type LangChainProviderConfig = BaseModelConfig & {
  capabilities?: Partial<ModelCapabilities>;
};

export type LangChainMessageRole = "system" | "human" | "ai" | "tool";

export type LangChainMessageLike = {
  role?: string;
  type?: string;
  content?: unknown;
  tool_call_id?: string;
  toolCallId?: string;
  name?: string;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
  tool_calls?: unknown;
  toolCalls?: unknown;
  usage_metadata?: LangChainUsageMetadata;
  _getType?: () => string;
};

export type LangChainChatInput = LangChainMessageLike[];

export type LangChainToolLike = {
  name: string;
  description?: string;
  schema?: unknown;
  inputSchema?: unknown;
};

export type LangChainCallOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  maxOutputTokens?: number;
  stop?: string[];
  tools?: LangChainToolLike[];
  responseFormat?: GenerateInput["responseFormat"];
  providerOptions?: Record<string, unknown>;
  [key: string]: unknown;
};

export type LangChainUsageMetadata = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

export type LangChainChatModelLike = {
  invoke(input: LangChainChatInput, options?: LangChainCallOptions): Promise<unknown>;
  stream(input: LangChainChatInput, options?: LangChainCallOptions): AsyncIterable<unknown>;
};

export type LangChainChatProviderOptions<
  Config extends LangChainProviderConfig = LangChainProviderConfig,
> = {
  id: string;
  displayName?: string;
  metadata?: Partial<ProviderMetadata>;
  capabilities?: Partial<ModelCapabilities>;
  toolCallingMode?: ToolCallingMode;
  structuredOutputMode?: StructuredOutputMode;
  createChatModel(
    config: Config,
    context?: ProviderContext,
  ): LangChainChatModelLike | Promise<LangChainChatModelLike>;
};

export class LangChainChatModelBridge implements UniversalChatModel {
  readonly id: string;
  readonly provider: string;
  readonly displayName?: string;
  readonly capabilities: ModelCapabilities;
  readonly toolCallingMode: ToolCallingMode;
  readonly structuredOutputMode: StructuredOutputMode;

  readonly #chatModel: LangChainChatModelLike;

  constructor(
    config: LangChainProviderConfig,
    chatModel: LangChainChatModelLike,
    options: {
      provider: string;
      displayName?: string;
      capabilities?: Partial<ModelCapabilities>;
      toolCallingMode?: ToolCallingMode;
      structuredOutputMode?: StructuredOutputMode;
    },
  ) {
    this.id = config.model;
    this.provider = options.provider;
    this.displayName = options.displayName ?? config.model;
    this.capabilities = chatModelCapabilities({
      toolCalling: true,
      structuredOutput: true,
      ...options.capabilities,
      ...config.capabilities,
    });
    this.toolCallingMode = options.toolCallingMode ?? "native";
    this.structuredOutputMode = options.structuredOutputMode ?? "provider-native";
    this.#chatModel = chatModel;
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const result = await this.#chatModel.invoke(
      toLangChainMessages(input.messages),
      toLangChainCallOptions(input),
    );

    return toGenerateResult(result);
  }

  async *stream(input: GenerateInput): AsyncIterable<ModelEvent> {
    const toolCalls = new Map<string, ToolCallAccumulator>();

    try {
      for await (const chunk of this.#chatModel.stream(
        toLangChainMessages(input.messages),
        toLangChainCallOptions(input),
      )) {
        const text = getTextContent(chunk);
        if (text) yield { type: "text-delta", text };

        const reasoning = getReasoningContent(chunk);
        if (reasoning) yield { type: "reasoning-delta", text: reasoning };

        collectToolCallChunks(chunk, toolCalls);

        const usage = toTokenUsage(getUsageMetadata(chunk));
        if (usage) yield { type: "usage", usage };
      }

      yield* flushToolCalls(toolCalls);
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        error: {
          code: "STREAM_INTERRUPTED",
          message: error instanceof Error ? error.message : "LangChain model stream failed.",
          provider: this.provider,
          model: this.id,
          retryable: true,
          originalError: error,
        },
      };
    }
  }
}

export const createLangChainChatProvider = <
  Config extends LangChainProviderConfig = LangChainProviderConfig,
>(
  options: LangChainChatProviderOptions<Config>,
): ModelProvider<Config> => {
  const displayName = options.displayName ?? options.id;

  return {
    id: options.id,
    displayName,
    metadata: {
      id: options.id,
      displayName,
      backing: "langchain",
      authModes: ["custom"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      ...options.metadata,
    },
    validateConfig(config: unknown): asserts config is Config {
      void config;
    },
    async createModel(config, context) {
      const chatModel = await options.createChatModel(config, context);
      return new LangChainChatModelBridge(config, chatModel, {
        provider: options.id,
        displayName: config.model,
        capabilities: options.capabilities,
        toolCallingMode: options.toolCallingMode,
        structuredOutputMode: options.structuredOutputMode,
      });
    },
  };
};

export const registerLangChainChatProvider = <
  Config extends LangChainProviderConfig = LangChainProviderConfig,
>(
  options: LangChainChatProviderOptions<Config>,
): void => {
  globalProviderRegistry.set(createLangChainChatProvider(options));
};

type ToolCallAccumulator = {
  id?: string;
  name?: string;
  argumentsText: string;
  argumentsValue?: unknown;
};

const toLangChainMessages = (messages: ModelMessage[]): LangChainMessageLike[] =>
  messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        type: "tool",
        tool_call_id: message.toolCallId,
        content: toLangChainContent(message.content),
      };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        type: "ai",
        content: toLangChainContent(message.content ?? ""),
        tool_calls: message.toolCalls?.map(toLangChainToolCall),
        additional_kwargs: message.toolCalls?.length
          ? { tool_calls: message.toolCalls.map(toLangChainRawToolCall) }
          : {},
      };
    }

    return {
      role: message.role === "user" ? "human" : message.role,
      type: message.role === "user" ? "human" : message.role,
      content: toLangChainContent(message.content),
    };
  });

const toLangChainContent = (content: MessageContent): unknown => {
  if (!Array.isArray(content)) return content;

  return content.map((part) => {
    if (part.type === "image") {
      return {
        type: "image_url",
        image_url: {
          url: part.image instanceof URL ? part.image.toString() : part.image,
        },
      };
    }

    return part;
  });
};

const toLangChainCallOptions = (input: GenerateInput): LangChainCallOptions => ({
  signal: input.signal,
  temperature: input.temperature,
  maxTokens: input.maxOutputTokens,
  maxOutputTokens: input.maxOutputTokens,
  stop: input.stopSequences,
  tools: input.tools?.map(toLangChainTool),
  responseFormat: input.responseFormat,
  providerOptions: input.providerOptions,
  ...input.providerOptions,
});

const toLangChainTool = (tool: ToolDefinition): LangChainToolLike => ({
  name: tool.name,
  description: tool.description,
  schema: tool.inputSchema,
  inputSchema: tool.inputSchema,
});

const toLangChainToolCall = (toolCall: ToolCall) => ({
  id: toolCall.id,
  name: toolCall.name,
  args: toolCall.arguments,
});

const toLangChainRawToolCall = (toolCall: ToolCall) => ({
  id: toolCall.id,
  type: "function",
  function: {
    name: toolCall.name,
    arguments: JSON.stringify(toolCall.arguments),
  },
});

const toGenerateResult = (value: unknown): GenerateResult => {
  const record = asRecord(value);
  const additionalKwargs = asRecord(record?.additional_kwargs);
  const responseMetadata = asRecord(record?.response_metadata);

  return {
    text: getTextContent(value),
    toolCalls: toDocklineToolCalls(record?.tool_calls ?? record?.toolCalls ?? additionalKwargs?.tool_calls),
    usage: toTokenUsage(getUsageMetadata(value)),
    finishReason: toFinishReason(asString(responseMetadata?.finish_reason)),
    raw: value,
  };
};

const getTextContent = (value: unknown): string => {
  if (typeof value === "string") return value;

  const record = asRecord(value);
  const content = record?.content;

  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);

  return content
    .flatMap((part): string[] => {
      if (typeof part === "string") return [part];
      const partRecord = asRecord(part);
      return typeof partRecord?.text === "string" ? [partRecord.text] : [];
    })
    .join("");
};

const getReasoningContent = (value: unknown): string | undefined => {
  const record = asRecord(value);
  const responseMetadata = asRecord(record?.response_metadata);
  return asString(record?.reasoning_content)
    ?? asString(record?.reasoning)
    ?? asString(responseMetadata?.reasoning_content)
    ?? asString(responseMetadata?.reasoning);
};

const getUsageMetadata = (value: unknown): LangChainUsageMetadata | undefined => {
  const record = asRecord(value);
  const responseMetadata = asRecord(record?.response_metadata);
  return asUsageMetadata(record?.usage_metadata)
    ?? asUsageMetadata(record?.usage)
    ?? asUsageMetadata(responseMetadata?.tokenUsage)
    ?? asUsageMetadata(responseMetadata?.usage);
};

const toTokenUsage = (usage: LangChainUsageMetadata | undefined): TokenUsage | undefined => {
  if (!usage) return undefined;

  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens,
    outputTokens: usage.output_tokens ?? usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
};

const collectToolCallChunks = (
  value: unknown,
  toolCalls: Map<string, ToolCallAccumulator>,
): void => {
  const record = asRecord(value);
  const chunks = record?.tool_call_chunks ?? record?.toolCallChunks;

  if (Array.isArray(chunks)) {
    for (const chunk of chunks) collectToolCallChunk(chunk, toolCalls);
  }

  const completeToolCalls = toDocklineToolCalls(record?.tool_calls ?? record?.toolCalls);
  if (!completeToolCalls) return;

  for (const toolCall of completeToolCalls) {
    toolCalls.set(toolCall.id, {
      id: toolCall.id,
      name: toolCall.name,
      argumentsText: typeof toolCall.arguments === "string" ? toolCall.arguments : "",
      argumentsValue: toolCall.arguments,
    });
  }
};

const collectToolCallChunk = (
  value: unknown,
  toolCalls: Map<string, ToolCallAccumulator>,
): void => {
  const record = asRecord(value);
  if (!record) return;

  const index = typeof record.index === "number" ? record.index : undefined;
  const id = asString(record.id);
  const key = id ?? String(index ?? toolCalls.size);
  const accumulator = toolCalls.get(key) ?? { argumentsText: "" };
  const args = record.args ?? record.arguments;

  accumulator.id = id ?? accumulator.id;
  accumulator.name = asString(record.name) ?? accumulator.name;
  accumulator.argumentsText += typeof args === "string" ? args : "";
  if (args !== undefined && typeof args !== "string") accumulator.argumentsValue = args;

  toolCalls.set(key, accumulator);
};

async function* flushToolCalls(
  toolCalls: Map<string, ToolCallAccumulator>,
): AsyncIterable<ModelEvent> {
  for (const [key, toolCall] of toolCalls) {
    if (!toolCall.name) continue;

    yield {
      type: "tool-call",
      toolCall: {
        id: toolCall.id ?? key,
        name: toolCall.name,
        arguments: toolCall.argumentsValue ?? parseArguments(toolCall.argumentsText),
      },
    };
  }

  toolCalls.clear();
}

const toDocklineToolCalls = (toolCalls: unknown): ToolCall[] | undefined => {
  if (!Array.isArray(toolCalls)) return undefined;

  return toolCalls.flatMap((toolCall): ToolCall[] => {
    const record = asRecord(toolCall);
    if (!record) return [];

    const functionRecord = asRecord(record.function);
    const name = asString(record.name) ?? asString(functionRecord?.name);
    if (!name) return [];

    return [{
      id: asString(record.id) ?? "tool-call",
      name,
      arguments: parseArguments(record.args ?? record.arguments ?? functionRecord?.arguments),
    }];
  });
};

const toFinishReason = (value: string | undefined): GenerateResult["finishReason"] | undefined => {
  if (!value) return undefined;

  if (value === "stop" || value === "length") return value;
  if (value === "tool_calls" || value === "tool-calls") return "tool-calls";
  if (value === "content_filter" || value === "content-filter") return "content-filter";
  return "unknown";
};

const parseArguments = (value: unknown): unknown => {
  if (typeof value !== "string") return value ?? {};
  if (value.length === 0) return {};

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? value as Record<string, unknown> : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asUsageMetadata = (value: unknown): LangChainUsageMetadata | undefined =>
  value && typeof value === "object" ? value as LangChainUsageMetadata : undefined;
