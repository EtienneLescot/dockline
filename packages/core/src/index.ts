export {
  assertCapabilities,
  assertCapability,
  assertModelRequirements,
  type ModelRequirements,
} from "./assertions.js";
export {
  chatModelCapabilities,
  capabilitiesFromProfile,
  getMissingCapabilities,
  hasCapability,
  mergeCapabilityProfile,
  noModelCapabilities,
  type CapabilityName,
  type CapabilityProfile,
  type CapabilityProfileOverride,
  type ModelCapabilities,
  type StructuredOutputMode,
  type ToolCallingMode,
} from "./capabilities.js";
export {
  DocklineError,
  normalizeUnknownError,
  toDocklineError,
  type ModelErrorCode,
  type NormalizedModelError,
} from "./errors.js";
export {
  type AssistantMessage,
  type FileContentPart,
  type ImageContentPart,
  type JsonSchema,
  type MessageContent,
  type ModelMessage,
  type ResponseFormat,
  type SystemMessage,
  type TextContentPart,
  type ToolCall,
  type ToolDefinition,
  type ToolMessage,
  type ToolResult,
  type UserMessage,
} from "./messages.js";
export {
  type GenerateInput,
  type GenerateResult,
  type ModelEvent,
  type TokenUsage,
  type UniversalChatModel,
} from "./model.js";
export {
  createModel,
  getProviderMetadata,
  globalProviderRegistry,
  listAvailableProviders,
  listProviderMetadata,
  listProviderModels,
  listProviders,
  MemoryTokenStore,
  ProviderRegistry,
  testProviderConnection,
  validateBaseModelConfig,
  validateProviderDiscoveryConfig,
  type BaseModelConfig,
  type ModelDescriptor,
  type ModelProvider,
  type ProviderDiscoveryConfig,
  type ProviderContext,
  type ProviderAuthMode,
  type ProviderBacking,
  type ProviderMetadata,
  type ReasoningOptionDescriptor,
  type RuntimeOptionDescriptor,
  type RuntimeOptionValue,
  type TestConnectionResult,
  type TestConnectionStatus,
  type TokenRecord,
  type TokenStore,
} from "./provider.js";

/**
 * Alpha APIs are exported behind this namespace while their contracts are still
 * expected to change before a stable release.
 */
export * as experimental from "./experimental.js";
