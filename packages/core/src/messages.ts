export type TextContentPart = {
  type: "text";
  text: string;
};

export type ImageContentPart = {
  type: "image";
  image: URL | string;
  mediaType?: string;
};

export type FileContentPart = {
  type: "file";
  data: Uint8Array | string;
  mediaType: string;
  filename?: string;
};

export type MessageContent = string | Array<TextContentPart | ImageContentPart | FileContentPart>;

export type SystemMessage = {
  role: "system";
  content: MessageContent;
};

export type UserMessage = {
  role: "user";
  content: MessageContent;
};

export type AssistantMessage = {
  role: "assistant";
  content?: MessageContent;
  toolCalls?: ToolCall[];
};

export type ToolMessage = {
  role: "tool";
  toolCallId: string;
  content: MessageContent;
};

export type ModelMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
};

export type ToolDefinition = {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type ToolResult = {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json-object" }
  | { type: "json-schema"; name: string; schema: JsonSchema; strict?: boolean };

