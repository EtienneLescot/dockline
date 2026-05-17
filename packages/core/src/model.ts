import type { ModelCapabilities, StructuredOutputMode, ToolCallingMode } from "./capabilities.js";
import type { NormalizedModelError } from "./errors.js";
import type { ModelMessage, ResponseFormat, ToolCall, ToolDefinition, ToolResult } from "./messages.js";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GenerateInput = {
  messages: ModelMessage[];
  tools?: ToolDefinition[];
  responseFormat?: ResponseFormat;
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
  providerOptions?: Record<string, unknown>;
};

export type GenerateResult = {
  text: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: "stop" | "length" | "tool-calls" | "content-filter" | "unknown";
  raw?: unknown;
};

export type ModelEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCall: ToolCall }
  | { type: "tool-result"; toolResult: ToolResult }
  | { type: "reasoning-delta"; text: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "error"; error: NormalizedModelError }
  | { type: "done" };

export interface UniversalChatModel {
  id: string;
  provider: string;
  displayName?: string;
  capabilities: ModelCapabilities;
  toolCallingMode?: ToolCallingMode;
  structuredOutputMode?: StructuredOutputMode;

  generate(input: GenerateInput): Promise<GenerateResult>;
  stream(input: GenerateInput): AsyncIterable<ModelEvent>;
}

export type RuntimeCapabilities = ModelCapabilities & {
  workspaceAccess: boolean;
  commandExecution: boolean;
};

export type CodingAgentInput = {
  prompt: string;
  workspacePath?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type CodingAgentEvent =
  | { type: "message"; text: string }
  | { type: "file-change"; path: string; operation: "create" | "update" | "delete" }
  | { type: "command"; command: string; status: "started" | "completed" | "failed" }
  | { type: "error"; error: NormalizedModelError }
  | { type: "done" };

export interface CodingAgentRuntime {
  id: string;
  provider: string;
  displayName?: string;
  capabilities: RuntimeCapabilities;

  run(input: CodingAgentInput): AsyncIterable<CodingAgentEvent>;
}

