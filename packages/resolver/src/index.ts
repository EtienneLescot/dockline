import {
  getCatalogProvider,
  listCatalogProviders,
  type ProviderCatalogEntry,
} from "@dockline/catalog";
import type {
  ModelProvider,
  ProviderAuthMode,
  ProviderBacking,
  ProviderRegistry,
} from "@dockline/core";

export type ConnectorEnvironmentName = "node" | "browser" | "edge" | "vscode";

export type ConnectorEnvironment = Partial<Record<ConnectorEnvironmentName, boolean>>;

export type ConnectorCandidateStatus = "available" | "planned";

export type ConnectorCandidate = {
  catalogProviderId: string;
  providerId?: string;
  backing: ProviderBacking;
  authModes?: ProviderAuthMode[];
  requiredPackages?: string[];
  environments?: ConnectorEnvironmentName[];
  status?: ConnectorCandidateStatus;
  message?: string;
  createProvider?: () => ModelProvider;
};

export type ResolveConnectorInput = {
  provider: string;
  authMode?: ProviderAuthMode;
  preferredBacking?: ProviderBacking;
  environment?: ConnectorEnvironment;
  installedPackages?: string[];
};

export type ResolveConnectorStatus =
  | "unknown-provider"
  | "unsupported-auth-mode"
  | "unsupported-environment"
  | "missing-package"
  | "planned-native"
  | "unsupported";

export type ResolveConnectorSuccess = {
  ok: true;
  provider: ModelProvider;
  catalogProvider: ProviderCatalogEntry;
  backing: ProviderBacking;
  requiredPackages: string[];
};

export type ResolveConnectorFailure = {
  ok: false;
  status: ResolveConnectorStatus;
  provider: string;
  catalogProvider?: ProviderCatalogEntry;
  message: string;
  requiredPackages?: string[];
  availableBackings?: ProviderBacking[];
};

export type ResolveConnectorResult = ResolveConnectorSuccess | ResolveConnectorFailure;

export type ConnectorResolverOptions = {
  candidates?: ConnectorCandidate[];
};

export type ConnectorResolver = {
  listCandidates(provider?: string): ConnectorCandidate[];
  resolve(input: ResolveConnectorInput): ResolveConnectorResult;
  register(input: ResolveConnectorInput, registry: ProviderRegistry): ResolveConnectorResult;
};

const backingPriority: ProviderBacking[] = [
  "native",
  "gateway",
  "openai-compatible",
  "vercel-ai-sdk",
  "langchain",
  "custom",
];

export const createConnectorResolver = (
  options: ConnectorResolverOptions = {},
): ConnectorResolver => {
  const candidates = options.candidates?.map(cloneCandidate) ?? [];

  return {
    listCandidates(provider) {
      if (!provider) return candidates.map(cloneCandidate);
      const catalogProvider = getCatalogProvider(provider);
      const normalized = normalizeId(catalogProvider?.id ?? provider);

      return candidates
        .filter((candidate) => normalizeId(candidate.catalogProviderId) === normalized)
        .map(cloneCandidate);
    },
    resolve(input) {
      return resolveConnector(input, { candidates });
    },
    register(input, registry) {
      const result = resolveConnector(input, { candidates });
      if (result.ok) registry.set(result.provider);
      return result;
    },
  };
};

export const resolveConnector = (
  input: ResolveConnectorInput,
  options: ConnectorResolverOptions = {},
): ResolveConnectorResult => {
  const catalogProvider = getCatalogProvider(input.provider);

  if (!catalogProvider) {
    return {
      ok: false,
      status: "unknown-provider",
      provider: input.provider,
      message: `Unknown Dockline catalog provider "${input.provider}".`,
    };
  }

  if (input.authMode && !catalogProvider.authModes.includes(input.authMode)) {
    return {
      ok: false,
      status: "unsupported-auth-mode",
      provider: catalogProvider.id,
      catalogProvider,
      message: `Provider "${catalogProvider.id}" does not support auth mode "${input.authMode}".`,
      availableBackings: catalogProvider.availableBackings,
    };
  }

  const candidates = sortCandidates(
    (options.candidates ?? [])
      .filter((candidate) => normalizeId(candidate.catalogProviderId) === normalizeId(catalogProvider.id))
      .filter((candidate) => !input.preferredBacking || candidate.backing === input.preferredBacking),
    input.preferredBacking,
  );

  if (candidates.length === 0) {
    if (catalogProvider.status === "planned-native") {
      return plannedResult(catalogProvider);
    }

    return {
      ok: false,
      status: "unsupported",
      provider: catalogProvider.id,
      catalogProvider,
      message: input.preferredBacking
        ? `Provider "${catalogProvider.id}" has no registered "${input.preferredBacking}" connector candidate.`
        : `Provider "${catalogProvider.id}" has no registered connector candidate.`,
      availableBackings: catalogProvider.availableBackings,
    };
  }

  for (const candidate of candidates) {
    const authModeError = candidateAuthModeError(input, candidate, catalogProvider);
    if (authModeError) return authModeError;

    const environmentError = candidateEnvironmentError(input, candidate, catalogProvider);
    if (environmentError) return environmentError;

    const missingPackages = missingRequiredPackages(candidate, input.installedPackages);
    if (missingPackages.length > 0) {
      return {
        ok: false,
        status: "missing-package",
        provider: catalogProvider.id,
        catalogProvider,
        message: `Provider "${catalogProvider.id}" requires missing package(s): ${missingPackages.join(", ")}.`,
        requiredPackages: candidate.requiredPackages,
        availableBackings: catalogProvider.availableBackings,
      };
    }

    if (candidate.status === "planned") {
      return plannedResult(catalogProvider, candidate);
    }

    if (!candidate.createProvider) {
      continue;
    }

    return {
      ok: true,
      provider: candidate.createProvider(),
      catalogProvider,
      backing: candidate.backing,
      requiredPackages: candidate.requiredPackages ?? [],
    };
  }

  if (catalogProvider.status === "planned-native") {
    return plannedResult(catalogProvider);
  }

  return {
    ok: false,
    status: "unsupported",
    provider: catalogProvider.id,
    catalogProvider,
    message: `Provider "${catalogProvider.id}" has connector candidates, but none can create a provider in this environment.`,
    availableBackings: catalogProvider.availableBackings,
  };
};

export const listResolvableCatalogProviders = (
  options: ConnectorResolverOptions = {},
): ProviderCatalogEntry[] => {
  const resolvableIds = new Set(
    (options.candidates ?? [])
      .filter((candidate) => candidate.status !== "planned")
      .filter((candidate) => typeof candidate.createProvider === "function")
      .map((candidate) => normalizeId(candidate.catalogProviderId)),
  );

  return listCatalogProviders()
    .filter((provider) => resolvableIds.has(normalizeId(provider.id)));
};

const plannedResult = (
  catalogProvider: ProviderCatalogEntry,
  candidate?: ConnectorCandidate,
): ResolveConnectorFailure => ({
  ok: false,
  status: "planned-native",
  provider: catalogProvider.id,
  catalogProvider,
  message: candidate?.message ??
    catalogProvider.notes ??
    `Provider "${catalogProvider.id}" is planned but not implemented yet.`,
  requiredPackages: candidate?.requiredPackages,
  availableBackings: catalogProvider.availableBackings,
});

const candidateAuthModeError = (
  input: ResolveConnectorInput,
  candidate: ConnectorCandidate,
  catalogProvider: ProviderCatalogEntry,
): ResolveConnectorFailure | undefined => {
  if (!input.authMode || !candidate.authModes) return undefined;
  if (candidate.authModes.includes(input.authMode)) return undefined;

  return {
    ok: false,
    status: "unsupported-auth-mode",
    provider: catalogProvider.id,
    catalogProvider,
    message: `Connector for "${catalogProvider.id}" with backing "${candidate.backing}" does not support auth mode "${input.authMode}".`,
    availableBackings: catalogProvider.availableBackings,
  };
};

const candidateEnvironmentError = (
  input: ResolveConnectorInput,
  candidate: ConnectorCandidate,
  catalogProvider: ProviderCatalogEntry,
): ResolveConnectorFailure | undefined => {
  if (!candidate.environments || candidate.environments.length === 0) return undefined;
  if (!input.environment) return undefined;
  if (candidate.environments.some((environment) => input.environment?.[environment])) return undefined;

  return {
    ok: false,
    status: "unsupported-environment",
    provider: catalogProvider.id,
    catalogProvider,
    message: `Connector for "${catalogProvider.id}" with backing "${candidate.backing}" does not support the requested environment.`,
    availableBackings: catalogProvider.availableBackings,
  };
};

const missingRequiredPackages = (
  candidate: ConnectorCandidate,
  installedPackages: string[] | undefined,
): string[] => {
  if (!candidate.requiredPackages || candidate.requiredPackages.length === 0) return [];
  if (!installedPackages) return [];

  const installed = new Set(installedPackages);
  return candidate.requiredPackages.filter((packageName) => !installed.has(packageName));
};

const sortCandidates = (
  candidates: ConnectorCandidate[],
  preferredBacking: ProviderBacking | undefined,
): ConnectorCandidate[] =>
  [...candidates].sort((left, right) => {
    if (preferredBacking) return 0;
    return backingRank(left.backing) - backingRank(right.backing);
  });

const backingRank = (backing: ProviderBacking): number => {
  const index = backingPriority.indexOf(backing);
  return index === -1 ? backingPriority.length : index;
};

const cloneCandidate = (candidate: ConnectorCandidate): ConnectorCandidate => ({
  ...candidate,
  authModes: candidate.authModes ? [...candidate.authModes] : undefined,
  requiredPackages: candidate.requiredPackages ? [...candidate.requiredPackages] : undefined,
  environments: candidate.environments ? [...candidate.environments] : undefined,
});

const normalizeId = (id: string): string =>
  id.trim().toLowerCase().replace(/[_\s/]+/g, "-");
