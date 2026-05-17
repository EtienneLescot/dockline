import {
  getMissingCapabilities,
  type CapabilityName,
  type StructuredOutputMode,
  type ToolCallingMode,
} from "./capabilities.js";
import { DocklineError } from "./errors.js";
import type { UniversalChatModel } from "./model.js";

const formatList = (values: readonly string[]): string => values.join(", ");

export const assertCapability = (
  model: UniversalChatModel,
  capability: CapabilityName,
): void => {
  if (model.capabilities[capability]) return;

  throw new DocklineError({
    code: "UNSUPPORTED_CAPABILITY",
    message: `Model "${model.id}" from provider "${model.provider}" does not support capability "${capability}".`,
    provider: model.provider,
    model: model.id,
    retryable: false,
  });
};

export const assertCapabilities = (
  model: UniversalChatModel,
  capabilities: readonly CapabilityName[],
): void => {
  const missing = getMissingCapabilities(model.capabilities, capabilities);
  if (missing.length === 0) return;

  throw new DocklineError({
    code: "UNSUPPORTED_CAPABILITY",
    message: `Model "${model.id}" from provider "${model.provider}" is missing required capabilities: ${formatList(missing)}.`,
    provider: model.provider,
    model: model.id,
    retryable: false,
  });
};

export type ModelRequirements = {
  capabilities?: readonly CapabilityName[];
  toolCallingMode?: ToolCallingMode | readonly ToolCallingMode[];
  structuredOutputMode?: StructuredOutputMode | readonly StructuredOutputMode[];
};

const normalizeRequiredModes = <Mode extends string>(
  mode: Mode | readonly Mode[] | undefined,
): readonly Mode[] => {
  if (!mode) return [];
  if (typeof mode === "string") return [mode];
  return mode;
};

export const assertModelRequirements = (
  model: UniversalChatModel,
  requirements: ModelRequirements,
): void => {
  if (requirements.capabilities) {
    assertCapabilities(model, requirements.capabilities);
  }

  const toolCallingModes = normalizeRequiredModes(requirements.toolCallingMode);
  if (toolCallingModes.length > 0 && !toolCallingModes.includes(model.toolCallingMode ?? "unsupported")) {
    throw new DocklineError({
      code: "UNSUPPORTED_CAPABILITY",
      message: `Model "${model.id}" from provider "${model.provider}" requires tool calling mode ${formatList(toolCallingModes)}, but has ${model.toolCallingMode ?? "unsupported"}.`,
      provider: model.provider,
      model: model.id,
      retryable: false,
    });
  }

  const structuredOutputModes = normalizeRequiredModes(requirements.structuredOutputMode);
  if (
    structuredOutputModes.length > 0 &&
    !structuredOutputModes.includes(model.structuredOutputMode ?? "unsupported")
  ) {
    throw new DocklineError({
      code: "UNSUPPORTED_CAPABILITY",
      message: `Model "${model.id}" from provider "${model.provider}" requires structured output mode ${formatList(structuredOutputModes)}, but has ${model.structuredOutputMode ?? "unsupported"}.`,
      provider: model.provider,
      model: model.id,
      retryable: false,
    });
  }
};
