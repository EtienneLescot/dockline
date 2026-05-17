# Auth UX Design

Dockline should make provider authentication explicit to the end user and boring
for the host application. The user chooses a provider, chooses a supported
connection type, Dockline validates it, and the selected model/runtime reports
only the capabilities that are actually available.

This document is product and API design. It is not a claim that every flow is
currently implemented.

## Non-Negotiable Boundary

Dockline must not use scraped tokens, browser profile extraction, private
undocumented endpoints, reverse-engineered refresh flows, or provider ToS
workarounds.

Account-backed connectors are allowed only when they use documented OAuth,
device-code, SDK-delegated, environment-provided, or equivalent official flows.
If a provider does not offer a documented flow for the target use case, Dockline
must show that path as unsupported and keep the API-key path separate.

## Common UX Contract

Host applications should be able to render this flow from provider metadata:

1. User chooses a provider.
2. User chooses a connection type shown for that provider.
3. Dockline collects only the fields required for that connection type.
4. Dockline stores credentials through the configured `TokenStore`, or returns
   an in-memory/session credential if persistence is disabled.
5. Dockline runs `testConnection()` when the connector supports it.
6. Dockline lists models through `listModels()` when supported.
7. User chooses a model and optional runtime settings.
8. Host application persists the chosen provider id, auth mode, model id, and
   runtime options, not raw secrets unless explicitly configured to do so.

Every auth mode should expose:

```ts
type ProviderAuthMode = {
  id: string;
  label: string;
  kind:
    | "api-key"
    | "oauth-pkce"
    | "device-code"
    | "headless-device-code"
    | "environment"
    | "sdk-delegated"
    | "token-plan";
  status: "stable" | "experimental" | "planned" | "unsupported";
  persistence: "none" | "memory" | "token-store" | "host-managed";
  userFields?: AuthFieldDescriptor[];
  termsNote?: string;
};
```

## OpenAI

OpenAI should expose API-key auth as the default, stable path.

API-key UX:

1. User selects `OpenAI`.
2. User selects `API key`.
3. Host app asks for an API key or points to an environment variable such as
   `OPENAI_API_KEY`.
4. Dockline validates the key with a minimal documented API request when
   `testConnection()` is available.
5. Dockline lists models when the official API supports the required discovery
   path.

OAuth, PKCE, device-code, and headless variants are allowed only when OpenAI
documents and authorizes those flows for the target product surface. They should
live in a separate connector package or separate registration path from plain
API-key OpenAI so integrators can avoid account-backed behavior entirely.

OpenAI account-backed UX when officially available:

1. User selects `OpenAI`.
2. User selects the official account flow presented by the connector.
3. For browser-capable hosts, Dockline starts OAuth/PKCE and returns the user to
   the host app callback.
4. For CLI or SSH/headless hosts, Dockline starts the documented device flow,
   shows the verification URL and user code, and polls according to provider
   instructions.
5. Dockline stores refresh/access tokens only through the configured token
   store, never in logs or model configuration dumps.
6. Dockline labels the auth mode as account-backed and shows any provider terms
   or product-scope constraints supplied by the connector metadata.

If OpenAI does not provide a documented account flow for a use case, Dockline
must not emulate one. The UI should show `API key` only, or show the account
flow as `unsupported` with a concise terms note.

## Copilot

Copilot support must be treated as an agent/runtime connector, not just another
API-key chat model.

Allowed auth paths:

- official device-code flow;
- official SDK-delegated auth;
- environment or IDE-provided auth exposed through a documented API.

Disallowed paths:

- reading tokens from editor internals;
- copying tokens from local browser or app storage;
- calling private Copilot endpoints that are not documented for external use;
- asking users to paste subscription tokens meant for first-party clients.

Copilot UX:

1. User selects `GitHub Copilot` or the host app exposes it under coding-agent
   runtimes.
2. User sees only documented connection modes.
3. Device flow shows the verification URL, user code, expiry, and polling
   status.
4. SDK-delegated or IDE-provided auth clearly says the host environment owns
   login and token refresh.
5. Dockline reports runtime capabilities separately from chat-model
   capabilities, including workspace access, tool calling, and streaming shape
   only when available through the official surface.

If no documented path is available for the target runtime, Dockline should ship
no Copilot connector for that runtime.

## Provider Token-Plan Variants

Some providers may expose both normal API-key access and subscription,
credit-plan, or account-token-plan access. Dockline should model these as
separate auth modes and, when behavior materially differs, separate provider ids
or packages.

Examples:

- `minimax`: API-key MiniMax access.
- `minimax-token-plan`: documented subscription/token-plan access, only if the
  provider supports it for third-party integrations.
- `openai`: API-key OpenAI access.
- `openai-oauth`: official account-backed OpenAI access, only if documented for
  this use case.

Token-plan UX:

1. User selects the provider.
2. User selects `API key` or the documented token-plan/account mode.
3. Dockline shows the billing/account scope and terms note from metadata.
4. Dockline validates access and lists models available under that plan.
5. Runtime metadata reports plan-specific limitations such as model access,
   rate limits, context limits, or unsupported features when the provider
   exposes them.

Token-plan connectors must not launder a consumer subscription into an API when
the provider terms do not allow it. The connector should prefer a clear
`unsupported` status over a clever workaround.

## Headless And Device Flow Details

Headless auth is a UI mode, not a separate permission boundary. It is acceptable
only when backed by a documented device-code or equivalent official flow.

Required UI fields:

- verification URL;
- user code;
- expiry timestamp or remaining seconds;
- polling status;
- cancellation control;
- final success/failure state.

Required implementation behavior:

- obey provider polling intervals;
- stop polling on expiry, cancellation, or terminal errors;
- never print access or refresh tokens;
- allow host applications to provide their own token store;
- return structured errors for denied, expired, slow-down, and unsupported
  states.

## Storage And Logging

Token persistence should be host-controlled.

Initial token stores:

- memory for tests and ephemeral sessions;
- filesystem for local CLI/dev tools;
- optional OS keychain later;
- host-managed store for SaaS products.

Rules:

- secrets must not appear in logs, thrown error messages, telemetry, provider
  metadata, or serialized model configs;
- docs examples should prefer environment variables for API keys;
- account-backed packages should be isolated so applications that do not need
  them do not install them;
- logout must revoke tokens when the provider supports revocation and must
  delete local credentials even when revocation is unavailable.

## Documentation Requirements

Each account-backed connector must document:

- provider docs link or official SDK used;
- supported host environments;
- required scopes;
- token storage expectations;
- logout/revocation behavior;
- known terms, plan, or product-scope limits;
- explicit unsupported flows.
