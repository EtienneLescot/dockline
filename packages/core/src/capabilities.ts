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

export type CapabilityProfile = {
  provider: string;
  model?: string;
  displayName?: string;
  capabilities?: Partial<ModelCapabilities>;
  toolCallingMode?: ToolCallingMode;
  structuredOutputMode?: StructuredOutputMode;
  contextWindow?: number;
  maxOutputTokens?: number;
  notes?: readonly string[];
  source?: string;
  updatedAt?: string;
};

export type CapabilityProfileOverride = Partial<CapabilityProfile>;

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

export const hasCapability = (
  capabilities: ModelCapabilities,
  capability: CapabilityName,
): boolean => capabilities[capability];

export const getMissingCapabilities = (
  capabilities: ModelCapabilities,
  required: readonly CapabilityName[],
): CapabilityName[] => required.filter((capability) => !hasCapability(capabilities, capability));

export type ToolCallingMode = "native" | "emulated" | "unsupported";

export type StructuredOutputMode =
  | "json-schema"
  | "provider-native"
  | "prompt-fallback"
  | "unsupported";

export const mergeCapabilityProfile = (
  known: CapabilityProfile,
  runtimeOverride: CapabilityProfileOverride = {},
): CapabilityProfile => ({
  ...known,
  ...runtimeOverride,
  capabilities: {
    ...known.capabilities,
    ...runtimeOverride.capabilities,
  },
});

export const capabilitiesFromProfile = (
  profile: Pick<CapabilityProfile, "capabilities"> | undefined,
  defaults: ModelCapabilities = noModelCapabilities(),
): ModelCapabilities => ({
  ...defaults,
  ...profile?.capabilities,
});
