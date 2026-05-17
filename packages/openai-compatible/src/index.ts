import {
  chatModelCapabilities,
  DocklineError,
  globalProviderRegistry,
  type BaseModelConfig,
  type GenerateInput,
  type GenerateResult,
  type ModelCapabilities,
  type ModelDescriptor,
  type ModelEvent,
  type ModelMessage,
  type ModelProvider,
  type ProviderDiscoveryConfig,
  type ResponseFormat,
  type TestConnectionResult,
  type TokenUsage,
  type ToolCall,
  type ToolDefinition,
  type UniversalChatModel,
} from "@dockline/core";

export type OpenAICompatibleConfig = BaseModelConfig & {
  provider: "openai-compatible" | string;
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
  capabilities?: Partial<ModelCapabilities>;
};

export type OpenAICompatibleProviderOptions = {
  id?: string;
  displayName?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  capabilities?: Partial<ModelCapabilities>;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type OpenAIModelsResponse = {
  data?: unknown;
};

type ToolCallAccumulator = {
  id?: string;
  name?: string;
  argumentsText: string;
};

const finishReasonMap: Record<string, GenerateResult["finishReason"]> = {
  stop: "stop",
  length: "length",
  tool_calls: "tool-calls",
  content_filter: "content-filter",
};

export class OpenAICompatibleChatModel implements UniversalChatModel {
  readonly id: string;
  readonly provider: string;
  readonly displayName?: string;
  readonly capabilities: ModelCapabilities;
  readonly toolCallingMode = "native" as const;
  readonly structuredOutputMode = "json-schema" as const;

  readonly #baseURL: string;
  readonly #apiKey?: string;
  readonly #headers: Record<string, string>;

  constructor(config: OpenAICompatibleConfig, options: OpenAICompatibleProviderOptions = {}) {
    this.id = config.model;
    this.provider = options.id ?? config.provider;
    this.displayName = config.model;
    this.#baseURL = normalizeBaseURL(options.baseURL ?? config.baseURL);
    this.#apiKey = config.apiKey;
    this.#headers = { ...options.headers, ...config.headers };
    this.capabilities = chatModelCapabilities({
      toolCalling: true,
      structuredOutput: true,
      vision: true,
      ...options.capabilities,
      ...config.capabilities,
    });
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const response = await this.#request(input, false);
    const json = (await response.json()) as OpenAIChatCompletionResponse;
    const choice = json.choices?.[0];
    const message = choice?.message;

    return {
      text: message?.content ?? "",
      toolCalls: message?.tool_calls?.map(toDocklineToolCall),
      usage: toTokenUsage(json.usage),
      finishReason: choice?.finish_reason
        ? finishReasonMap[choice.finish_reason] ?? "unknown"
        : undefined,
      raw: json,
    };
  }

  async *stream(input: GenerateInput): AsyncIterable<ModelEvent> {
    let response: Response;
    try {
      response = await this.#request(input, true);
    } catch (error) {
      yield {
        type: "error",
        error: toNormalizedError(error, this.provider, this.id),
      };
      return;
    }

    if (!response.body) {
      yield {
        type: "error",
        error: {
          code: "STREAM_INTERRUPTED",
          message: "Provider returned no response body for streaming request.",
          provider: this.provider,
          model: this.id,
          retryable: true,
        },
      };
      return;
    }

    const toolCalls = new Map<number, ToolCallAccumulator>();

    try {
      for await (const payload of parseServerSentEvents(response.body)) {
        if (payload === "[DONE]") {
          yield* flushToolCalls(toolCalls);
          yield { type: "done" };
          return;
        }

        const chunk = JSON.parse(payload) as Record<string, unknown>;
        const choice = getFirstChoice(chunk);
        const delta = choice?.delta;

        if (!delta) continue;

        const text = getString(delta, "content");
        if (text) yield { type: "text-delta", text };

        const reasoning = getString(delta, "reasoning_content") ?? getString(delta, "reasoning");
        if (reasoning) yield { type: "reasoning-delta", text: reasoning };

        collectToolCallDeltas(delta, toolCalls);

        const usage = toTokenUsage(chunk.usage);
        if (usage) yield { type: "usage", usage };

        if (choice.finish_reason === "tool_calls") {
          yield* flushToolCalls(toolCalls);
        }
      }

      yield* flushToolCalls(toolCalls);
      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        error: {
          code: "STREAM_INTERRUPTED",
          message: error instanceof Error ? error.message : "Streaming response was interrupted.",
          provider: this.provider,
          model: this.id,
          retryable: true,
          originalError: error,
        },
      };
    }
  }

  async #request(input: GenerateInput, stream: boolean): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.#baseURL}/chat/completions`, {
        method: "POST",
        signal: input.signal,
        headers: {
          "content-type": "application/json",
          ...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
          ...this.#headers,
        },
        body: JSON.stringify(toOpenAIRequestBody(input, this.id, stream)),
      });
    } catch (error) {
      throw toRequestError(error, this.provider, this.id);
    }

    if (!response.ok) {
      throw await toProviderError(response, this.provider, this.id);
    }

    return response;
  }
}

export const createOpenAICompatibleModel = (
  config: OpenAICompatibleConfig,
  options?: OpenAICompatibleProviderOptions,
): OpenAICompatibleChatModel => new OpenAICompatibleChatModel(config, options);

export const createOpenAICompatibleProvider = (
  options: OpenAICompatibleProviderOptions = {},
): ModelProvider<OpenAICompatibleConfig> => {
  const id = options.id ?? "openai-compatible";
  const displayName = options.displayName ?? "OpenAI-compatible";

  return {
    id,
    displayName,
    metadata: {
      id,
      displayName,
      backing: "openai-compatible",
      authModes: ["api-key", "custom"],
      supportsModelDiscovery: true,
      supportsConnectionTest: true,
      runtimeOptions: [
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
      ],
    },
    validateConfig(config: unknown): asserts config is OpenAICompatibleConfig {
      void config;
    },
    async createModel(config) {
      assertHasBaseURL(config, options);
      return createOpenAICompatibleModel(config, options);
    },
    async testConnection(config) {
      return testOpenAICompatibleConnection(config, options);
    },
    async listModels(config) {
      return listOpenAICompatibleModels(config, options);
    },
  };
};

export const registerOpenAICompatibleProvider = (
  options?: OpenAICompatibleProviderOptions,
): void => {
  globalProviderRegistry.set(createOpenAICompatibleProvider(options));
};

const normalizeBaseURL = (baseURL: string): string => baseURL.replace(/\/+$/, "");

const assertHasBaseURL = (
  config: Partial<OpenAICompatibleConfig> | null,
  options: OpenAICompatibleProviderOptions,
): void => {
  if (!config?.baseURL && !options.baseURL) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "OpenAI-compatible provider requires a baseURL.",
      provider: options.id ?? config?.provider,
      model: config?.model,
      retryable: false,
    });
  }
};

const getConfiguredBaseURL = (
  config: Pick<ProviderDiscoveryConfig, "baseURL">,
  options: OpenAICompatibleProviderOptions,
): string | undefined => {
  const baseURL = options.baseURL ?? config.baseURL;
  return baseURL ? normalizeBaseURL(baseURL) : undefined;
};

const getDiscoveryHeaders = (
  config: Pick<ProviderDiscoveryConfig, "apiKey" | "headers">,
  options: OpenAICompatibleProviderOptions,
): Record<string, string> => ({
  ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
  ...options.headers,
  ...config.headers,
});

const testOpenAICompatibleConnection = async (
  config: OpenAICompatibleConfig,
  options: OpenAICompatibleProviderOptions,
): Promise<TestConnectionResult> => {
  const provider = options.id ?? config.provider;
  const baseURL = getConfiguredBaseURL(config, options);

  if (!baseURL) {
    return {
      ok: false,
      status: "misconfigured",
      provider,
      model: config.model,
      message: "OpenAI-compatible provider requires a baseURL.",
      retryable: false,
    };
  }

  const result = await requestOpenAICompatibleModels(config, options);

  if (!result.ok) {
    return {
      ok: false,
      status: toConnectionStatus(result.status),
      provider,
      model: config.model,
      message: result.message,
      retryable: result.retryable,
      details: { statusCode: result.status },
    };
  }

  if (!Array.isArray(result.body.data)) {
    return {
      ok: false,
      status: "misconfigured",
      provider,
      model: config.model,
      message: "OpenAI-compatible models response must include a data array.",
      retryable: false,
    };
  }

  const models = toModelDescriptors(result.body, provider);
  if (config.model && models.length > 0 && !models.some((model) => model.id === config.model)) {
    return {
      ok: false,
      status: "misconfigured",
      provider,
      model: config.model,
      message: `Model "${config.model}" was not found in the provider model list.`,
      retryable: false,
    };
  }

  return {
    ok: true,
    status: "ok",
    provider,
    model: config.model,
    retryable: false,
    details: { modelCount: models.length },
  };
};

const listOpenAICompatibleModels = async (
  config: ProviderDiscoveryConfig,
  options: OpenAICompatibleProviderOptions,
): Promise<ModelDescriptor[]> => {
  const provider = options.id ?? config.provider;
  const baseURL = getConfiguredBaseURL(config, options);

  if (!baseURL) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "OpenAI-compatible provider requires a baseURL to list models.",
      provider,
      retryable: false,
    });
  }

  const result = await requestOpenAICompatibleModels(config, options);

  if (!result.ok) {
    throw new DocklineError({
      code: toErrorCode(result.status, result.message),
      message: result.message,
      provider,
      model: config.model,
      statusCode: result.status,
      retryable: result.retryable,
    });
  }

  if (!Array.isArray(result.body.data)) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "OpenAI-compatible models response must include a data array.",
      provider,
      model: config.model,
      retryable: false,
    });
  }

  return toModelDescriptors(result.body, provider);
};

type ModelsRequestResult =
  | {
      ok: true;
      body: OpenAIModelsResponse;
    }
  | {
      ok: false;
      status: number;
      message: string;
      retryable: boolean;
    };

const requestOpenAICompatibleModels = async (
  config: Pick<ProviderDiscoveryConfig, "apiKey" | "baseURL" | "headers">,
  options: OpenAICompatibleProviderOptions,
): Promise<ModelsRequestResult> => {
  const baseURL = getConfiguredBaseURL(config, options);
  if (!baseURL) {
    return {
      ok: false,
      status: 400,
      message: "OpenAI-compatible provider requires a baseURL.",
      retryable: false,
    };
  }

  let response: Response;
  try {
    response = await fetch(`${baseURL}/models`, {
      method: "GET",
      headers: getDiscoveryHeaders(config, options),
    });
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : "OpenAI-compatible models request failed.",
      retryable: true,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await readErrorMessage(response),
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  try {
    return { ok: true, body: (await response.json()) as OpenAIModelsResponse };
  } catch (error) {
    return {
      ok: false,
      status: 422,
      message: error instanceof Error ? error.message : "OpenAI-compatible models response was invalid JSON.",
      retryable: false,
    };
  }
};

const toModelDescriptors = (
  body: OpenAIModelsResponse,
  provider: string,
): ModelDescriptor[] => {
  if (!Array.isArray(body.data)) return [];

  return body.data.flatMap((item): ModelDescriptor[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.length === 0) return [];

    return [
      {
        id: record.id,
        provider,
        displayName: typeof record.name === "string" ? record.name : undefined,
      },
    ];
  });
};

const toConnectionStatus = (status: number): TestConnectionResult["status"] => {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "unavailable";
  if (status === 400 || status === 404 || (status >= 405 && status < 500)) return "misconfigured";
  return "unavailable";
};

const stringifyContent = (content: ModelMessage["content"]): string => {
  if (!Array.isArray(content)) return content ?? "";

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
};

const toOpenAIMessage = (message: ModelMessage): Record<string, unknown> => {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: stringifyContent(message.content),
    };
  }

  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content ? stringifyContent(message.content) : null,
      tool_calls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      })),
    };
  }

  if (Array.isArray(message.content)) {
    return {
      role: message.role,
      content: message.content.map((part) => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (part.type === "image") return { type: "image_url", image_url: { url: String(part.image) } };
        throw new DocklineError({
          code: "UNSUPPORTED_CAPABILITY",
          message: "OpenAI-compatible chat completions file content is not supported by this connector yet.",
          retryable: false,
        });
      }),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
};

const toOpenAITool = (tool: ToolDefinition): Record<string, unknown> => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  },
});

const toOpenAIResponseFormat = (
  responseFormat: ResponseFormat | undefined,
): Record<string, unknown> | undefined => {
  if (!responseFormat || responseFormat.type === "text") return undefined;
  if (responseFormat.type === "json-object") return { type: "json_object" };

  return {
    type: "json_schema",
    json_schema: {
      name: responseFormat.name,
      schema: responseFormat.schema,
      strict: responseFormat.strict,
    },
  };
};

const toOpenAIRequestBody = (
  input: GenerateInput,
  model: string,
  stream: boolean,
): Record<string, unknown> =>
  compactObject({
    model,
    messages: input.messages.map(toOpenAIMessage),
    tools: input.tools && input.tools.length > 0 ? input.tools.map(toOpenAITool) : undefined,
    response_format: toOpenAIResponseFormat(input.responseFormat),
    temperature: input.temperature,
    max_tokens: input.maxOutputTokens,
    stop: input.stopSequences && input.stopSequences.length > 0 ? input.stopSequences : undefined,
    stream,
    ...input.providerOptions,
  });

const compactObject = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

const toDocklineToolCall = (
  toolCall: NonNullable<OpenAIChatCompletionResponse["choices"]>[number]["message"] extends infer Message
    ? Message extends { tool_calls?: Array<infer ToolCall> }
      ? ToolCall
      : never
    : never,
): ToolCall => ({
  id: toolCall.id,
  name: toolCall.function.name,
  arguments: parseToolArguments(toolCall.function.arguments),
});

const parseToolArguments = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toTokenUsage = (usage: unknown): TokenUsage | undefined => {
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;

  return {
    inputTokens: typeof record.prompt_tokens === "number" ? record.prompt_tokens : undefined,
    outputTokens: typeof record.completion_tokens === "number" ? record.completion_tokens : undefined,
    totalTokens: typeof record.total_tokens === "number" ? record.total_tokens : undefined,
  };
};

async function* parseServerSentEvents(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  const reader = body.getReader();

  const flushEvent = function* (): Iterable<string> {
    if (dataLines.length > 0) {
      yield dataLines.join("\n");
      dataLines = [];
    }
  };

  const readLine = (line: string): void => {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line === "") return;

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    if (field !== "data") return;

    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const newlineIndex = buffer.search(/\r\n|\r|\n/);
        if (newlineIndex === -1) break;

        const newline =
          buffer[newlineIndex] === "\r" && buffer[newlineIndex + 1] === "\n"
            ? "\r\n"
            : buffer[newlineIndex];
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + newline.length);

        if (line === "" || line === "\r") {
          yield* flushEvent();
        } else {
          readLine(line);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  buffer += decoder.decode();

  if (buffer) readLine(buffer);
  yield* flushEvent();
};

const toRequestError = (error: unknown, provider: string, model: string): DocklineError => {
  if (error instanceof DocklineError) return error;

  const aborted =
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError");

  return new DocklineError({
    code: aborted ? "UNKNOWN_ERROR" : "PROVIDER_UNAVAILABLE",
    message: aborted
      ? "OpenAI-compatible request was aborted."
      : error instanceof Error
        ? error.message
        : "OpenAI-compatible request failed.",
    provider,
    model,
    retryable: !aborted,
    originalError: error,
  });
};

const toNormalizedError = (
  error: unknown,
  provider: string,
  model: string,
): ReturnType<DocklineError["toJSON"]> => {
  if (error instanceof DocklineError) return error.toJSON();

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown OpenAI-compatible provider error.",
    provider,
    model,
    retryable: false,
    originalError: error,
  };
};

const readErrorMessage = async (response: Response): Promise<string> => {
  const body = await response.text();
  if (!body) return response.statusText;

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    const error = parsed.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const message = record.message ?? record.code ?? record.type;
      if (typeof message === "string") return message;
    }
  } catch {
    // Keep the raw body as message when it is not JSON.
  }

  return body;
}

const getFirstChoice = (
  chunk: Record<string, unknown>,
): { delta?: Record<string, unknown>; finish_reason?: string } | undefined => {
  const choices = chunk.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  return first && typeof first === "object"
    ? (first as { delta?: Record<string, unknown>; finish_reason?: string })
    : undefined;
};

const getString = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === "string" ? record[key] : undefined;

const collectToolCallDeltas = (
  delta: Record<string, unknown>,
  toolCalls: Map<number, ToolCallAccumulator>,
): void => {
  const deltas = delta.tool_calls;
  if (!Array.isArray(deltas)) return;

  for (const item of deltas) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const index = typeof record.index === "number" ? record.index : 0;
    const accumulator = toolCalls.get(index) ?? { argumentsText: "" };
    const fn = record.function;

    if (typeof record.id === "string") accumulator.id = record.id;
    if (fn && typeof fn === "object") {
      const functionDelta = fn as Record<string, unknown>;
      if (typeof functionDelta.name === "string") accumulator.name = functionDelta.name;
      if (typeof functionDelta.arguments === "string") {
        accumulator.argumentsText += functionDelta.arguments;
      }
    }

    toolCalls.set(index, accumulator);
  }
};

async function* flushToolCalls(
  toolCalls: Map<number, ToolCallAccumulator>,
): AsyncIterable<ModelEvent> {
  for (const [index, toolCall] of [...toolCalls.entries()].sort(([a], [b]) => a - b)) {
    if (!toolCall.name) continue;

    yield {
      type: "tool-call",
      toolCall: {
        id: toolCall.id ?? `tool-call-${index}`,
        name: toolCall.name,
        arguments: parseToolArguments(toolCall.argumentsText || "{}"),
      },
    };
  }

  toolCalls.clear();
}

const toProviderError = async (
  response: Response,
  provider: string,
  model: string,
): Promise<DocklineError> => {
  const message = await readErrorMessage(response);

  return new DocklineError({
    code: toErrorCode(response.status, message),
    message,
    provider,
    model,
    statusCode: response.status,
    retryable: response.status === 429 || response.status >= 500,
  });
};

const toErrorCode = (status: number, message: string) => {
  const lowerMessage = message.toLowerCase();

  if (status === 401) return "AUTHENTICATION_ERROR";
  if (status === 403) return "AUTHORIZATION_ERROR";
  if (status === 404) return "MODEL_NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (lowerMessage.includes("context")) return "CONTEXT_LENGTH_EXCEEDED";
  if (status >= 400 && status < 500) return "INVALID_REQUEST";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN_ERROR";
};
