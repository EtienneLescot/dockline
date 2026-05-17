export type ModelCapabilities = {
  textGeneration: boolean;
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  reasoning: boolean;
  vision: boolean;
  files: boolean;
  promptCaching: boolean;
  embeddings: boolean;
  imageGeneration: boolean;
  computerUse: boolean;
  localExecution: boolean;
  codingAgentRuntime: boolean;
};

export type CapabilityName = keyof ModelCapabilities;

export const noModelCapabilities = (): ModelCapabilities => ({
  textGeneration: false,
  streaming: false,
  toolCalling: false,
  structuredOutput: false,
  reasoning: false,
  vision: false,
  files: false,
  promptCaching: false,
  embeddings: false,
  imageGeneration: false,
  computerUse: false,
  localExecution: false,
  codingAgentRuntime: false,
});

export const chatModelCapabilities = (
  overrides: Partial<ModelCapabilities> = {},
): ModelCapabilities => ({
  ...noModelCapabilities(),
  textGeneration: true,
  streaming: true,
  ...overrides,
});

export type ToolCallingMode = "native" | "emulated" | "unsupported";

export type StructuredOutputMode =
  | "json-schema"
  | "provider-native"
  | "prompt-fallback"
  | "unsupported";

