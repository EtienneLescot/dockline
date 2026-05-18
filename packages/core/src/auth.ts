import { DocklineError } from "./errors.js";
import type { TokenRecord, TokenStore } from "./provider.js";

export type AuthFlowKind =
  | "api-key"
  | "oauth-pkce"
  | "device-code"
  | "headless-device-code"
  | "environment"
  | "sdk-delegated"
  | "token-plan"
  | (string & {});

export type AuthModeStatus = "stable" | "experimental" | "planned" | "unsupported";

export type AuthPersistence = "none" | "memory" | "token-store" | "host-managed";

export type AuthFieldDescriptor = {
  id: string;
  type: "string" | "password" | "url" | "boolean" | "select";
  displayName?: string;
  description?: string;
  required?: boolean;
  enumValues?: Array<{
    value: string;
    displayName?: string;
    description?: string;
  }>;
};

export type ProviderAuthModeDescriptor = {
  id: string;
  label: string;
  kind: AuthFlowKind;
  status: AuthModeStatus;
  persistence: AuthPersistence;
  userFields?: AuthFieldDescriptor[];
  scopes?: string[];
  termsNote?: string;
};

export type AuthTokenKeyInput = {
  provider: string;
  authMode: string;
  accountId?: string;
  model?: string;
};

export type AuthTokenStoreReference = {
  provider: string;
  authMode: string;
  subject?: string;
  scopes?: readonly string[];
};

export type AuthTokenStoreKey = string | AuthTokenKeyInput | AuthTokenStoreReference;

export type OAuthPKCEAuthorizationRequest = {
  authorizationURL: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  expiresAt?: number;
};

export type OAuthPKCECallback = {
  code: string;
  state: string;
  redirectURL?: string;
};

export type DeviceCodeAuthorization = {
  deviceCode: string;
  userCode: string;
  verificationURL: string;
  verificationURLComplete?: string;
  expiresAt: number;
  intervalSeconds: number;
  message?: string;
};

export type DeviceCodePollStatus =
  | "pending"
  | "slow-down"
  | "authorized"
  | "denied"
  | "expired"
  | "error";

export type DeviceCodePollResult =
  | {
      status: "pending" | "slow-down";
      intervalSeconds?: number;
    }
  | {
      status: "authorized";
      token: TokenRecord;
      accountId?: string;
    }
  | {
      status: "denied" | "expired" | "error";
      error?: DocklineError;
    };

export interface OAuthPKCEFlow {
  start(input: AuthStartInput): Promise<OAuthPKCEAuthorizationRequest>;
  complete(
    callback: OAuthPKCECallback,
    context: AuthFlowContext,
  ): Promise<AuthCompletion>;
}

export interface DeviceCodeFlow {
  start(input: AuthStartInput): Promise<DeviceCodeAuthorization>;
  poll(
    authorization: DeviceCodeAuthorization,
    context: AuthFlowContext,
  ): Promise<DeviceCodePollResult>;
}

export type AuthStartInput = {
  provider: string;
  authMode: string;
  scopes?: string[];
  redirectURL?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
};

export type AuthFlowContext = {
  tokenStore?: TokenStore;
  signal?: AbortSignal;
};

export type AuthCompletion = {
  token: TokenRecord;
  accountId?: string;
};

export type AuthAccount = {
  id?: string;
  displayName?: string;
  username?: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

export type AuthTokenResult = {
  token: TokenRecord;
  account?: AuthAccount;
  tokenStoreKey?: AuthTokenStoreKey;
  metadata?: Record<string, unknown>;
};

export type OAuthPkceCodeChallengeMethod = "S256" | "plain" | (string & {});

export type OAuthPkceStartInput = {
  provider: string;
  clientId: string;
  authorizationEndpoint: string;
  redirectUri: string;
  scopes?: readonly string[];
  state?: string;
  codeChallenge: string;
  codeChallengeMethod?: OAuthPkceCodeChallengeMethod;
  additionalParameters?: Record<string, string>;
};

export type OAuthPkceAuthorizationSession = {
  provider: string;
  authorizationUrl: string;
  redirectUri: string;
  codeVerifier: string;
  state?: string;
  scopes?: readonly string[];
  expiresAt?: number;
  metadata?: Record<string, unknown>;
};

export type OAuthPkceCompleteInput = {
  provider: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  state?: string;
  expectedState?: string;
  tokenStoreKey?: AuthTokenStoreKey;
  metadata?: Record<string, unknown>;
};

export type OAuthTokenRefreshInput = {
  provider: string;
  refreshToken: string;
  scopes?: readonly string[];
  tokenStoreKey?: AuthTokenStoreKey;
  metadata?: Record<string, unknown>;
};

export type AuthTokenRevokeInput = {
  provider: string;
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token" | (string & {});
  tokenStoreKey?: AuthTokenStoreKey;
  metadata?: Record<string, unknown>;
};

export interface OAuthPkceAuthProvider {
  startOAuthPkceAuthorization(input: OAuthPkceStartInput): Promise<OAuthPkceAuthorizationSession>;
  completeOAuthPkceAuthorization(input: OAuthPkceCompleteInput): Promise<AuthTokenResult>;
  refreshOAuthToken?(input: OAuthTokenRefreshInput): Promise<AuthTokenResult>;
  revokeOAuthToken?(input: AuthTokenRevokeInput): Promise<void>;
}

export type DeviceCodeStartInput = {
  provider: string;
  clientId?: string;
  scopes?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type DeviceCodeAuthorizationSession = DeviceCodeAuthorization & {
  provider: string;
  scopes?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type DeviceCodePollInput = {
  provider: string;
  deviceCode: string;
  tokenStoreKey?: AuthTokenStoreKey;
  metadata?: Record<string, unknown>;
};

export interface DeviceCodeAuthProvider {
  startDeviceAuthorization(input: DeviceCodeStartInput): Promise<DeviceCodeAuthorizationSession>;
  pollDeviceAuthorization(input: DeviceCodePollInput): Promise<DeviceCodePollResult>;
  refreshDeviceToken?(input: OAuthTokenRefreshInput): Promise<AuthTokenResult>;
  revokeDeviceToken?(input: AuthTokenRevokeInput): Promise<void>;
}

const cloneTokenRecord = (record: TokenRecord): TokenRecord => ({
  accessToken: record.accessToken,
  refreshToken: record.refreshToken,
  expiresAt: record.expiresAt,
  scopes: record.scopes ? [...record.scopes] : undefined,
  metadata: record.metadata ? { ...record.metadata } : undefined,
});

export const createAuthTokenKey = (input: AuthTokenKeyInput): string => {
  assertNonEmptyString(input.provider, "provider");
  assertNonEmptyString(input.authMode, "authMode");

  return [
    "dockline",
    "auth",
    encodeURIComponent(input.provider),
    encodeURIComponent(input.authMode),
    encodeURIComponent(input.accountId ?? "default"),
    input.model ? encodeURIComponent(input.model) : undefined,
  ].filter(Boolean).join(":");
};

export const createAuthTokenStoreKey = (input: AuthTokenStoreReference): string => {
  assertNonEmptyString(input.provider, "provider");
  assertNonEmptyString(input.authMode, "authMode");

  if (input.subject !== undefined) assertNonEmptyString(input.subject, "subject");

  if (
    input.scopes !== undefined &&
    input.scopes.some((scope) => typeof scope !== "string" || scope.trim().length === 0)
  ) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Auth token reference scopes must be non-empty strings.",
      retryable: false,
    });
  }

  const scopes = input.scopes
    ? [...new Set(input.scopes)].sort((left, right) => left.localeCompare(right))
    : [];
  const parts: Array<[string, string]> = [
    ["provider", input.provider],
    ["auth", input.authMode],
    ...(input.subject ? ([["subject", input.subject]] as Array<[string, string]>) : []),
    ...scopes.map((scope): [string, string] => ["scope", scope]),
  ];

  return `auth:${new URLSearchParams(parts).toString()}`;
};

const resolveAuthTokenKey = (input: AuthTokenStoreKey): string => {
  if (typeof input === "string") {
    assertNonEmptyString(input, "tokenStoreKey");
    return input;
  }

  if ("subject" in input || "scopes" in input) {
    return createAuthTokenStoreKey(input);
  }

  return createAuthTokenKey(input);
};

export const persistAuthToken = async (
  tokenStore: TokenStore | undefined,
  keyInput: AuthTokenKeyInput,
  token: TokenRecord,
): Promise<void> => {
  if (!tokenStore) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "A TokenStore is required to persist auth tokens.",
      provider: keyInput.provider,
      retryable: false,
    });
  }

  await tokenStore.set(createAuthTokenKey(keyInput), cloneTokenRecord(token));
};

export const readAuthToken = async (
  tokenStore: TokenStore | undefined,
  keyInput: AuthTokenKeyInput,
): Promise<TokenRecord | null> => {
  if (!tokenStore) return null;
  const token = await tokenStore.get(createAuthTokenKey(keyInput));
  return token ? cloneTokenRecord(token) : null;
};

export const setAuthToken = async (
  tokenStore: TokenStore,
  keyInput: AuthTokenStoreKey,
  token: TokenRecord,
): Promise<void> => {
  await tokenStore.set(resolveAuthTokenKey(keyInput), cloneTokenRecord(token));
};

export const getAuthToken = async (
  tokenStore: TokenStore,
  keyInput: AuthTokenStoreKey,
): Promise<TokenRecord | null> => {
  const token = await tokenStore.get(resolveAuthTokenKey(keyInput));
  return token ? cloneTokenRecord(token) : null;
};

export const deleteAuthToken = async (
  tokenStore: TokenStore | undefined,
  keyInput: AuthTokenStoreKey,
): Promise<void> => {
  if (!tokenStore) return;
  await tokenStore.delete(resolveAuthTokenKey(keyInput));
};

const assertNonEmptyString = (value: unknown, name: string): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: `Auth token key requires a non-empty ${name}.`,
      retryable: false,
    });
  }
};
