import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { ModelPickerItem } from '@tinker/design';
import type { OpencodeConnection } from '../bindings.js';

type ProviderModelSummary = {
  readonly id: string;
  readonly name: string;
  readonly limit: {
    readonly context: number;
  };
};

type ProviderSummary = {
  readonly id: string;
  readonly name: string;
  readonly models: Readonly<Record<string, ProviderModelSummary>>;
};

type ProviderAuthMethodSummary = {
  readonly type: string;
};

export type WorkspaceModelOption = ModelPickerItem & {
  readonly modelId: string;
};

export type OauthProviderSelection = {
  readonly providerId: string;
  readonly methodIndex: number;
};

export const getOpencodeDirectory = (vaultPath: string | null): string | undefined => {
  return vaultPath ?? undefined;
};

const trimLatestSuffix = (name: string): string => {
  return name.replace(/\s+\(latest\)$/iu, '').trim();
};

const buildModelOptionId = (providerId: string, modelId: string): string => {
  return `${providerId}:${modelId}`;
};

const getAuthorizationHeader = (connection: OpencodeConnection): string => {
  return `Basic ${btoa(`${connection.username}:${connection.password}`)}`;
};

export const createWorkspaceClient = (connection: OpencodeConnection, directory?: string) => {
  return createOpencodeClient({
    baseUrl: connection.baseUrl,
    headers: {
      Authorization: getAuthorizationHeader(connection),
    },
    ...(directory ? { directory } : {}),
  });
};

export const buildModelPickerItems = (
  providers: ReadonlyArray<ProviderSummary>,
): ReadonlyArray<WorkspaceModelOption> => {
  return providers.flatMap((provider) =>
    Object.values(provider.models).map((model) => {
      const normalizedName = trimLatestSuffix(model.name);
      return {
        id: buildModelOptionId(provider.id, model.id),
        modelId: model.id,
        providerId: provider.id,
        providerName: provider.name,
        name: normalizedName.length > 0 ? normalizedName : model.id,
        contextWindow: model.limit.context,
      };
    }),
  );
};

export const pickDefaultModelOptionId = (
  providers: ReadonlyArray<ProviderSummary>,
  defaults: Readonly<Record<string, string>>,
): string | undefined => {
  for (const provider of providers) {
    const defaultModelId = defaults[provider.id];
    if (!defaultModelId) {
      continue;
    }

    const model = provider.models[defaultModelId];
    if (model) {
      return buildModelOptionId(provider.id, model.id);
    }
  }

  return buildModelPickerItems(providers)[0]?.id;
};

export const findModelOptionById = (
  items: ReadonlyArray<WorkspaceModelOption>,
  id: string | undefined,
): WorkspaceModelOption | undefined => {
  return items.find((item) => item.id === id);
};

export const pickFirstOauthProvider = (
  providers: ReadonlyArray<Pick<ProviderSummary, 'id'>>,
  authMethods: Readonly<Record<string, ReadonlyArray<ProviderAuthMethodSummary>>>,
): OauthProviderSelection | null => {
  const orderedProviderIds: string[] = [];
  const seen = new Set<string>();

  for (const provider of providers) {
    if (!seen.has(provider.id)) {
      seen.add(provider.id);
      orderedProviderIds.push(provider.id);
    }
  }

  for (const providerId of Object.keys(authMethods)) {
    if (!seen.has(providerId)) {
      seen.add(providerId);
      orderedProviderIds.push(providerId);
    }
  }

  for (const providerId of orderedProviderIds) {
    const methods = authMethods[providerId] ?? [];
    const methodIndex = methods.findIndex((method) => method.type === 'oauth');
    if (methodIndex !== -1) {
      return { providerId, methodIndex };
    }
  }

  return null;
};
