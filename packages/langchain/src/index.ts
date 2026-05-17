import type {
  GenerateInput,
  GenerateResult,
  ImageContentPart,
  MessageContent,
  ModelEvent,
  ModelMessage,
  TextContentPart,
  ToolCall,
  ToolDefinition,
  UniversalChatModel,
} from "@dockline/core";

export type LangChainMessageRole = "system" | "human" | "ai" | "tool";

export type LangChainMessageLike =
  | string
  | {
      role?: string;
      type?: string;
      content?: unknown;
      tool_call_id?: string;
      toolCallId?: string;
      name?: string;
      additional_kwargs?: {
        tool_calls?: unknown;
        [key: string]: unknown;
      };
      tool_calls?: unknown;
      toolCalls?: unknown;
      _getType?: () => string;
    };

export type LangChainChatInput =
  | string
  | LangChainMessageLike[]
  | { messages: LangChainMessageLike[] };

export type LangChainToolLike = ToolDefinition | {
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
};

export type LangChainAIMessage = {
  lc_serializable: boolean;
  lc_namespace: string[];
  lc_kwargs: Record<string, unknown>;
  content: string;
  name?: string;
  additional_kwargs: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  tool_calls?: ToolCall[];
  usage_metadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  _getType: () => "ai";
};

export type LangChainAIMessageChunk = Omit<LangChainAIMessage, "tool_calls" | "_getType"> & {
  tool_call_chunks?: Array<{
    id: string;
    name: string;
    args: string;
    index?: number;
  }>;
  _getType: () => "ai";
};

export type LangChainChatModelAdapter = {
  lc_serializable: boolean;
  lc_namespace: string[];
  model: UniversalChatModel;
  invoke(input: LangChainChatInput, options?: LangChainCallOptions): Promise<LangChainAIMessage>;
  stream(input: LangChainChatInput, options?: LangChainCallOptions): AsyncIterable<LangChainAIMessageChunk>;
  bindTools(tools: LangChainToolLike[]): LangChainChatModelAdapter;
  _llmType(): string;
};

export const toLangChainChatModel = (
  model: UniversalChatModel,
  defaults: LangChainCallOptions = {},
): LangChainChatModelAdapter => {
  const adapter: LangChainChatModelAdapter = {
    lc_serializable: false,
    lc_namespace: ["dockline", "langchain"],
    model,
    async invoke(input, options) {
      const result = await model.generate(toGenerateInput(input, { ...defaults, ...options }));
      return toAIMessage(result);
    },
    async *stream(input, options) {
      for await (const event of model.stream(toGenerateInput(input, { ...defaults, ...options }))) {
        const chunk = toAIMessageChunk(event);
        if (chunk) yield chunk;
      }
    },
    bindTools(tools) {
      return toLangChainChatModel(model, {
        ...defaults,
        tools: [...(defaults.tools ?? []), ...tools],
      });
    },
    _llmType() {
      return "dockline";
    },
  };

  return adapter;
};

const toGenerateInput = (
  input: LangChainChatInput,
  options: LangChainCallOptions,
): GenerateInput => ({
  messages: toDocklineMessages(input),
  tools: options.tools?.map(toDocklineTool),
  responseFormat: options.responseFormat,
  temperature: options.temperature,
  maxOutputTokens: options.maxOutputTokens ?? options.maxTokens,
  stopSequences: options.stop,
  signal: options.signal,
  providerOptions: options.providerOptions,
});

const toDocklineMessages = (input: LangChainChatInput): ModelMessage[] => {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  const messages = Array.isArray(input) ? input : input.messages;
  return messages.map(toDocklineMessage);
};

const toDocklineMessage = (message: LangChainMessageLike): ModelMessage => {
  if (typeof message === "string") {
    return { role: "user", content: message };
  }

  const role = normalizeRole(message._getType?.() ?? message.type ?? message.role);
  const content = toMessageContent(message.content);

  if (role === "tool") {
    return {
      role: "tool",
      toolCallId: message.tool_call_id ?? message.toolCallId ?? message.name ?? "tool-call",
      content,
    };
  }

  if (role === "assistant") {
    return {
      role: "assistant",
      content,
      toolCalls: toDocklineToolCalls(message.tool_calls ?? message.toolCalls ?? message.additional_kwargs?.tool_calls),
    };
  }

  return {
    role,
    content,
  };
};

const normalizeRole = (role: string | undefined): "system" | "user" | "assistant" | "tool" => {
  if (role === "system") return "system";
  if (role === "human" || role === "user") return "user";
  if (role === "ai" || role === "assistant") return "assistant";
  if (role === "tool" || role === "function") return "tool";
  return "user";
};

const toMessageContent = (content: unknown): MessageContent => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);

  return content.flatMap((part): Array<TextContentPart | ImageContentPart> => {
    if (!part || typeof part !== "object") return [];
    const record = part as Record<string, unknown>;
    const type = record.type;

    if (type === "text" && typeof record.text === "string") {
      return [{ type: "text" as const, text: record.text }];
    }

    if (type === "image_url") {
      const imageUrl = record.image_url;
      const url =
        typeof imageUrl === "string"
          ? imageUrl
          : imageUrl && typeof imageUrl === "object"
            ? (imageUrl as Record<string, unknown>).url
            : undefined;
      return typeof url === "string" ? [{ type: "image" as const, image: url }] : [];
    }

    if (type === "image" && typeof record.image === "string") {
      return [{ type: "image" as const, image: record.image }];
    }

    return [];
  });
};

const toDocklineTool = (tool: LangChainToolLike): ToolDefinition => {
  if ("inputSchema" in tool && tool.inputSchema) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as ToolDefinition["inputSchema"],
    };
  }

  const schema = "schema" in tool ? tool.schema : undefined;

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: (schema as ToolDefinition["inputSchema"] | undefined) ?? { type: "object" },
  };
};

const toDocklineToolCalls = (toolCalls: unknown): ToolCall[] | undefined => {
  if (!Array.isArray(toolCalls)) return undefined;

  return toolCalls.flatMap((toolCall): ToolCall[] => {
    if (!toolCall || typeof toolCall !== "object") return [];
    const record = toolCall as Record<string, unknown>;
    const fn = record.function;
    const functionRecord = fn && typeof fn === "object" ? (fn as Record<string, unknown>) : undefined;
    const name = asString(record.name) ?? asString(functionRecord?.name);
    if (!name) return [];

    return [{
      id: asString(record.id) ?? "tool-call",
      name,
      arguments: parseArguments(record.args ?? record.arguments ?? functionRecord?.arguments),
    }];
  });
};

const toAIMessage = (result: GenerateResult): LangChainAIMessage => ({
  lc_serializable: true,
  lc_namespace: ["langchain_core", "messages"],
  lc_kwargs: {
    content: result.text,
    additional_kwargs: {},
    response_metadata: toResponseMetadata(result),
    tool_calls: result.toolCalls,
  },
  content: result.text,
  additional_kwargs: result.toolCalls?.length
    ? { tool_calls: result.toolCalls.map(toLangChainRawToolCall) }
    : {},
  response_metadata: toResponseMetadata(result),
  tool_calls: result.toolCalls,
  usage_metadata: toUsageMetadata(result.usage),
  _getType: () => "ai",
});

const toAIMessageChunk = (event: ModelEvent): LangChainAIMessageChunk | undefined => {
  if (event.type === "text-delta") {
    return createChunk({ content: event.text });
  }

  if (event.type === "tool-call") {
    return createChunk({
      content: "",
      tool_call_chunks: [{
        id: event.toolCall.id,
        name: event.toolCall.name,
        args: JSON.stringify(event.toolCall.arguments),
        index: 0,
      }],
    });
  }

  if (event.type === "usage") {
    return createChunk({
      content: "",
      usage_metadata: toUsageMetadata(event.usage),
    });
  }

  return undefined;
};

const createChunk = (
  overrides: Partial<LangChainAIMessageChunk>,
): LangChainAIMessageChunk => ({
  lc_serializable: true,
  lc_namespace: ["langchain_core", "messages"],
  lc_kwargs: {
    content: overrides.content ?? "",
    additional_kwargs: {},
    response_metadata: overrides.response_metadata ?? {},
  },
  content: overrides.content ?? "",
  additional_kwargs: overrides.additional_kwargs ?? {},
  response_metadata: overrides.response_metadata ?? {},
  usage_metadata: overrides.usage_metadata,
  tool_call_chunks: overrides.tool_call_chunks,
  _getType: () => "ai",
});

const toResponseMetadata = (result: GenerateResult): Record<string, unknown> => ({
  finish_reason: result.finishReason,
  raw: result.raw,
});

const toUsageMetadata = (usage: GenerateResult["usage"] | undefined) => usage
  ? {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
    }
  : undefined;

const toLangChainRawToolCall = (toolCall: ToolCall) => ({
  id: toolCall.id,
  type: "function",
  function: {
    name: toolCall.name,
    arguments: JSON.stringify(toolCall.arguments),
  },
});

const parseArguments = (value: unknown): unknown => {
  if (typeof value !== "string") return value ?? {};

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
