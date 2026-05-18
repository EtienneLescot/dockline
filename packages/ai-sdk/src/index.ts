import {
  chatModelCapabilities,
  globalProviderRegistry,
  type BaseModelConfig,
  type GenerateInput,
  type GenerateResult,
  type JsonSchema,
  type MessageContent,
  type ModelCapabilities,
  type ModelEvent,
  type ModelMessage,
  type ModelProvider,
  type ProviderContext,
  type ProviderMetadata,
  type ResponseFormat,
  type RuntimeOptionDescriptor,
  type StructuredOutputMode,
  type TokenUsage,
  type ToolCall,
  type ToolCallingMode,
  type ToolDefinition,
  type UniversalChatModel,
} from "@dockline/core";

export type AISDKProviderConfig = BaseModelConfig & {
  capabilities?: Partial<ModelCapabilities>;
};

export type AISDKProviderOptions<
  Config extends AISDKProviderConfig = AISDKProviderConfig,
> = {
  id: string;
  displayName?: string;
  metadata?: Partial<ProviderMetadata>;
  capabilities?: Partial<ModelCapabilities>;
  toolCallingMode?: ToolCallingMode;
  structuredOutputMode?: StructuredOutputMode;
  runtimeOptions?: RuntimeOptionDescriptor[];
  createLanguageModel(
    config: Config,
    context?: ProviderContext,
  ): AISDKLanguageModelV3Like | Promise<AISDKLanguageModelV3Like>;
};

export type AISDKLanguageModelV3Like = {
  readonly specificationVersion?: "v3" | string;
  readonly provider?: string;
  readonly modelId?: string;
  doGenerate(options: AISDKLanguageModelV3CallOptions): PromiseLike<AISDKLanguageModelV3GenerateResult>;
  doStream(options: AISDKLanguageModelV3CallOptions): PromiseLike<AISDKLanguageModelV3StreamResult>;
};

export type AISDKLanguageModelV3CallOptions = {
  prompt: AISDKLanguageModelV3Prompt;
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  responseFormat?: AISDKResponseFormat;
  tools?: AISDKTool[];
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export type AISDKLanguageModelV3Prompt = AISDKLanguageModelV3Message[];

export type AISDKLanguageModelV3Message =
  | { role: "system"; content: string; providerOptions?: Record<string, Record<string, unknown>> }
  | { role: "user"; content: AISDKPromptPart[]; providerOptions?: Record<string, Record<string, unknown>> }
  | { role: "assistant"; content: AISDKAssistantPart[]; providerOptions?: Record<string, Record<string, unknown>> }
  | { role: "tool"; content: AISDKToolResultPart[]; providerOptions?: Record<string, Record<string, unknown>> };

export type AISDKPromptPart =
  | { type: "text"; text: string }
  | { type: "file"; data: string | URL | Uint8Array; mediaType: string; filename?: string };

export type AISDKAssistantPart =
  | AISDKPromptPart
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown };

export type AISDKToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: { type: "json"; value: unknown } | { type: "text"; value: string };
};

export type AISDKTool = {
  type: "function";
  name: string;
  description?: string;
  inputSchema: JsonSchema;
};

export type AISDKResponseFormat =
  | { type: "text" }
  | { type: "json"; schema?: JsonSchema; name?: string; description?: string };

export type AISDKLanguageModelV3GenerateResult = {
  content: AISDKContent[];
  finishReason?: AISDKFinishReason;
  usage?: AISDKUsage;
  warnings?: unknown[];
  providerMetadata?: Record<string, unknown>;
  request?: unknown;
  response?: unknown;
};

export type AISDKLanguageModelV3StreamResult = {
  stream: ReadableStream<AISDKStreamPart> | AsyncIterable<AISDKStreamPart>;
  request?: unknown;
  response?: unknown;
};

export type AISDKContent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: string | unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: string; [key: string]: unknown };

export type AISDKStreamPart =
  | { type: "text-delta"; delta: string; id?: string }
  | { type: "reasoning-delta"; delta: string; id?: string }
  | { type: "tool-input-start"; id: string; toolName: string }
  | { type: "tool-input-delta"; id: string; delta: string }
  | { type: "tool-input-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: string | unknown }
  | { type: "finish"; usage?: AISDKUsage; finishReason?: AISDKFinishReason }
  | { type: "error"; error: unknown }
  | { type: string; [key: string]: unknown };

export type AISDKFinishReason =
  | { unified?: string; raw?: string }
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | string;

export type AISDKUsage = {
  inputTokens?: { total?: number };
  outputTokens?: { total?: number; reasoning?: number };
  totalTokens?: number;
  raw?: unknown;
};

export class AISDKChatModelBridge implements UniversalChatModel {
  readonly id: string;
  readonly provider: string;
  readonly displayName?: string;
  readonly capabilities: ModelCapabilities;
  readonly toolCallingMode: ToolCallingMode;
  readonly structuredOutputMode: StructuredOutputMode;

  readonly #languageModel: AISDKLanguageModelV3Like;

  constructor(
    config: AISDKProviderConfig,
    languageModel: AISDKLanguageModelV3Like,
    options: {
      provider: string;
      displayName?: string;
      capabilities?: Partial<ModelCapabilities>;
      toolCallingMode?: ToolCallingMode;
      structuredOutputMode?: StructuredOutputMode;
    },
  ) {
    this.id = languageModel.modelId ?? config.model;
    this.provider = options.provider;
    this.displayName = options.displayName ?? config.model;
    this.capabilities = chatModelCapabilities({
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      ...options.capabilities,
      ...config.capabilities,
    });
    this.toolCallingMode = options.toolCallingMode ?? "native";
    this.structuredOutputMode = options.structuredOutputMode ?? "json-schema";
    this.#languageModel = languageModel;
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const result = await this.#languageModel.doGenerate(toAISDKCallOptions(input));

    return {
      text: contentText(result.content),
      toolCalls: contentToolCalls(result.content),
      usage: toTokenUsage(result.usage),
      finishReason: toFinishReason(result.finishReason),
      raw: result,
    };
  }

  async *stream(input: GenerateInput): AsyncIterable<ModelEvent> {
    const toolCalls = new Map<string, ToolInputAccumulator>();

    try {
      const result = await this.#languageModel.doStream(toAISDKCallOptions(input));

      for await (const part of readStreamParts(result.stream)) {
        if (part.type === "text-delta") {
          yield { type: "text-delta", text: String(part.delta ?? "") };
          continue;
        }

        if (part.type === "reasoning-delta") {
          yield { type: "reasoning-delta", text: String(part.delta ?? "") };
          continue;
        }

        if (part.type === "tool-input-start") {
          const id = stringValue(part.id, "tool-call");
          const name = stringValue(part.toolName, "tool");
          toolCalls.set(id, { id, name, argumentsText: "" });
          continue;
        }

        if (part.type === "tool-input-delta") {
          const id = stringValue(part.id, "tool-call");
          const accumulator = toolCalls.get(id) ?? { id, argumentsText: "" };
          accumulator.argumentsText += stringValue(part.delta);
          toolCalls.set(id, accumulator);
          continue;
        }

        if (part.type === "tool-input-end") {
          yield* flushToolCall(toolCalls, stringValue(part.id, "tool-call"));
          continue;
        }

        if (part.type === "tool-call") {
          yield {
            type: "tool-call",
            toolCall: {
              id: stringValue(part.toolCallId, "tool-call"),
              name: stringValue(part.toolName, "tool"),
              arguments: parseArguments(part.input),
            },
          };
          continue;
        }

        if (part.type === "finish") {
          yield* flushToolCalls(toolCalls);
          const usage = toTokenUsage(usageValue(part.usage));
          if (usage) yield { type: "usage", usage };
          yield { type: "done" };
          return;
        }

        if (part.type === "error") {
          yield {
            type: "error",
            error: {
              code: "UNKNOWN_ERROR",
              message: part.error instanceof Error ? part.error.message : "AI SDK model stream failed.",
              provider: this.provider,
              model: this.id,
              retryable: false,
              originalError: part.error,
            },
          };
          return;
        }
      }

      yield* flushToolCalls(toolCalls);
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        error: {
          code: "STREAM_INTERRUPTED",
          message: error instanceof Error ? error.message : "AI SDK model stream failed.",
          provider: this.provider,
          model: this.id,
          retryable: true,
          originalError: error,
        },
      };
    }
  }
}

export const createAISDKChatProvider = <
  Config extends AISDKProviderConfig = AISDKProviderConfig,
>(
  options: AISDKProviderOptions<Config>,
): ModelProvider<Config> => {
  const displayName = options.displayName ?? options.id;

  return {
    id: options.id,
    displayName,
    metadata: {
      id: options.id,
      displayName,
      backing: "vercel-ai-sdk",
      authModes: ["custom"],
      supportsModelDiscovery: false,
      supportsConnectionTest: false,
      runtimeOptions: options.runtimeOptions,
      ...options.metadata,
    },
    validateConfig(config: unknown): asserts config is Config {
      void config;
    },
    async createModel(config, context) {
      const languageModel = await options.createLanguageModel(config, context);

      return new AISDKChatModelBridge(config, languageModel, {
        provider: options.id,
        displayName: config.model,
        capabilities: options.capabilities,
        toolCallingMode: options.toolCallingMode,
        structuredOutputMode: options.structuredOutputMode,
      });
    },
  };
};

export const registerAISDKChatProvider = <
  Config extends AISDKProviderConfig = AISDKProviderConfig,
>(
  options: AISDKProviderOptions<Config>,
): void => {
  globalProviderRegistry.set(createAISDKChatProvider(options));
};

const toAISDKCallOptions = (input: GenerateInput): AISDKLanguageModelV3CallOptions => ({
  prompt: toAISDKPrompt(input.messages),
  maxOutputTokens: input.maxOutputTokens,
  temperature: input.temperature,
  stopSequences: input.stopSequences,
  responseFormat: toAISDKResponseFormat(input.responseFormat),
  tools: input.tools?.map(toAISDKTool),
  abortSignal: input.signal,
  providerOptions: input.providerOptions as Record<string, Record<string, unknown>> | undefined,
  ...input.providerOptions,
});

const toAISDKPrompt = (messages: ModelMessage[]): AISDKLanguageModelV3Prompt =>
  messages.map((message) => {
    if (message.role === "system") {
      return { role: "system", content: stringifyContent(message.content) };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: [
          ...toAISDKPromptParts(message.content ?? ""),
          ...(message.toolCalls ?? []).map((toolCall): AISDKAssistantPart => ({
            type: "tool-call",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            input: toolCall.arguments,
          })),
        ],
      };
    }

    if (message.role === "tool") {
      return {
        role: "tool",
        content: [{
          type: "tool-result",
          toolCallId: message.toolCallId,
          toolName: "tool",
          output: toAISDKToolOutput(message.content),
        }],
      };
    }

    return { role: "user", content: toAISDKPromptParts(message.content) };
  });

const toAISDKPromptParts = (content: MessageContent): AISDKPromptPart[] => {
  if (!Array.isArray(content)) return [{ type: "text", text: content ?? "" }];

  return content.flatMap((part): AISDKPromptPart[] => {
    if (part.type === "text") return [{ type: "text", text: part.text }];
    if (part.type === "image") {
      return [{
        type: "file",
        data: part.image instanceof URL ? part.image : String(part.image),
        mediaType: part.mediaType ?? "image/*",
      }];
    }

    return [{
      type: "file",
      data: part.data instanceof URL ? part.data : part.data,
      mediaType: part.mediaType,
      filename: part.filename,
    }];
  });
};

const toAISDKToolOutput = (
  content: MessageContent,
): AISDKToolResultPart["output"] => {
  if (Array.isArray(content)) return { type: "text", value: stringifyContent(content) };

  try {
    return { type: "json", value: JSON.parse(content ?? "") };
  } catch {
    return { type: "text", value: content ?? "" };
  }
};

const stringifyContent = (content: MessageContent): string => {
  if (!Array.isArray(content)) return content ?? "";

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

const toAISDKTool = (tool: ToolDefinition): AISDKTool => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
});

const toAISDKResponseFormat = (
  responseFormat: ResponseFormat | undefined,
): AISDKResponseFormat | undefined => {
  if (!responseFormat || responseFormat.type === "text") return { type: "text" };

  return {
    type: "json",
    schema: responseFormat.type === "json-schema" ? responseFormat.schema : undefined,
    name: responseFormat.type === "json-schema" ? responseFormat.name : undefined,
  };
};

const contentText = (content: AISDKContent[]): string =>
  content
    .flatMap((part) => part.type === "text" ? [part.text] : [])
    .join("");

const contentToolCalls = (content: AISDKContent[]): ToolCall[] | undefined => {
  const toolCalls = content.flatMap((part): ToolCall[] => {
    if (part.type !== "tool-call") return [];

    const record = part as Record<string, unknown>;

    return [{
      id: stringValue(record.toolCallId, "tool-call"),
      name: stringValue(record.toolName, "tool"),
      arguments: parseArguments(record.input),
    }];
  });

  return toolCalls.length > 0 ? toolCalls : undefined;
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const usageValue = (value: unknown): AISDKUsage | undefined =>
  value && typeof value === "object" ? value as AISDKUsage : undefined;

const toTokenUsage = (usage: AISDKUsage | undefined): TokenUsage | undefined => {
  if (!usage) return undefined;

  const inputTokens = usage.inputTokens?.total;
  const outputTokens = usage.outputTokens?.total;
  const totalTokens = usage.totalTokens ??
    (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
};

const toFinishReason = (finishReason: AISDKFinishReason | undefined): GenerateResult["finishReason"] | undefined => {
  const value = typeof finishReason === "string" ? finishReason : finishReason?.unified;

  if (value === "stop" || value === "length") return value;
  if (value === "tool-calls") return "tool-calls";
  if (value === "content-filter") return "content-filter";
  if (value === "error" || value === "other") return "unknown";
  return value ? "unknown" : undefined;
};

async function* readStreamParts(
  stream: ReadableStream<AISDKStreamPart> | AsyncIterable<AISDKStreamPart>,
): AsyncIterable<AISDKStreamPart> {
  if (Symbol.asyncIterator in stream) {
    yield* stream as AsyncIterable<AISDKStreamPart>;
    return;
  }

  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

type ToolInputAccumulator = {
  id: string;
  name?: string;
  argumentsText: string;
};

async function* flushToolCall(
  toolCalls: Map<string, ToolInputAccumulator>,
  id: string,
): AsyncIterable<ModelEvent> {
  const toolCall = toolCalls.get(id);
  if (!toolCall?.name) return;

  yield {
    type: "tool-call",
    toolCall: {
      id: toolCall.id,
      name: toolCall.name,
      arguments: parseArguments(toolCall.argumentsText),
    },
  };

  toolCalls.delete(id);
}

async function* flushToolCalls(
  toolCalls: Map<string, ToolInputAccumulator>,
): AsyncIterable<ModelEvent> {
  for (const id of [...toolCalls.keys()]) {
    yield* flushToolCall(toolCalls, id);
  }
}

const parseArguments = (value: unknown): unknown => {
  if (typeof value !== "string") return value ?? {};
  if (value.length === 0) return {};

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
