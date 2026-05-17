export type ModelErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "CONTEXT_LENGTH_EXCEEDED"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "STREAM_INTERRUPTED"
  | "TOOL_CALL_ERROR"
  | "UNSUPPORTED_CAPABILITY"
  | "UNKNOWN_ERROR";

export type NormalizedModelError = {
  code: ModelErrorCode;
  message: string;
  provider?: string;
  model?: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: unknown;
};

export class DocklineError extends Error {
  readonly code: ModelErrorCode;
  readonly provider?: string;
  readonly model?: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly originalError?: unknown;

  constructor(error: NormalizedModelError) {
    super(error.message);
    this.name = "DocklineError";
    this.code = error.code;
    this.provider = error.provider;
    this.model = error.model;
    this.statusCode = error.statusCode;
    this.retryable = error.retryable;
    this.originalError = error.originalError;
  }

  toJSON(): NormalizedModelError {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      model: this.model,
      statusCode: this.statusCode,
      retryable: this.retryable,
      originalError: this.originalError,
    };
  }
}

export const normalizeUnknownError = (
  error: unknown,
  context: Pick<NormalizedModelError, "provider" | "model"> = {},
): NormalizedModelError => {
  if (error instanceof DocklineError) {
    return error.toJSON();
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown model error",
    provider: context.provider,
    model: context.model,
    retryable: false,
    originalError: error,
  };
};

export const toDocklineError = (
  error: unknown,
  context: Pick<NormalizedModelError, "provider" | "model"> = {},
): DocklineError => {
  if (error instanceof DocklineError) return error;
  return new DocklineError(normalizeUnknownError(error, context));
};

