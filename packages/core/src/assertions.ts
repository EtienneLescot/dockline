import type { CapabilityName } from "./capabilities.js";
import { DocklineError } from "./errors.js";
import type { UniversalChatModel } from "./model.js";

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

