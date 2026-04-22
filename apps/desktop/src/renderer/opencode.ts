import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { ModelPickerItem } from '@tinker/design';
import type { ReasoningLevel } from '@tinker/shared-types';
import type { OpencodeConnection } from '../bindings.js';

type ProviderModelCapabilities = {
  readonly reasoning?: boolean | string | null;
};

type ProviderModelVariantSummary =
  | string
  | {
      readonly id?: string;
      readonly name?: string;
    };

type ProviderModelSummary = {
  readonly id: string;
  readonly name: string;
  readonly limit: {
    readonly context: number;
  };
  readonly capabilities?: ProviderModelCapabilities;
  readonly variants?: ReadonlyArray<ProviderModelVariantSummary> | Readonly<Record<string, unknown>>;
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
  readonly storedId: string;
  readonly supportsReasoning: boolean;
  readonly reasoningVariants: Readonly<Partial<Record<ReasoningLevel, string>>>;
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

const buildStoredModelId = (providerId: string, modelId: string): string => {
  return `${providerId}/${modelId}`;
};

const REASONING_VARIANT_ALIASES: Readonly<Record<ReasoningLevel, ReadonlyArray<string>>> = {
  default: ['default', 'standard', 'normal', 'balanced'],
  low: ['low', 'minimal', 'light'],
  medium: ['medium'],
  high: ['high', 'deep', 'extended'],
  xhigh: ['xhigh', 'x-high', 'max', 'highest'],
};

const normalizeVariantName = (value: string): string => {
  return value.trim().toLowerCase();
};

const collectVariantNames = (
  variants: ProviderModelSummary['variants'],
): ReadonlyArray<string> => {
  if (variants === undefined) {
    return [];
  }

  if (Array.isArray(variants)) {
    return variants.flatMap((variant) => {
      if (typeof variant === 'string') {
        return [variant];
      }

      if (typeof variant.id === 'string') {
        return [variant.id];
      }

      if (typeof variant.name === 'string') {
        return [variant.name];
      }

      return [];
    });
  }

  return Object.keys(variants);
};

const findReasoningVariant = (
  variantNames: ReadonlyArray<string>,
  aliases: ReadonlyArray<string>,
): string | undefined => {
  return variantNames.find((name) => {
    const normalized = normalizeVariantName(name);
    return aliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
};

const buildReasoningVariants = (
  model: ProviderModelSummary,
): WorkspaceModelOption['reasoningVariants'] => {
  const variantNames = collectVariantNames(model.variants);
  const supportsReasoning = Boolean(model.capabilities?.reasoning) || variantNames.length > 0;

  if (!supportsReasoning) {
    return {};
  }

  return {
    low: findReasoningVariant(variantNames, REASONING_VARIANT_ALIASES.low) ?? 'low',
    medium: findReasoningVariant(variantNames, REASONING_VARIANT_ALIASES.medium) ?? 'medium',
    high: findReasoningVariant(variantNames, REASONING_VARIANT_ALIASES.high) ?? 'high',
  };
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
        storedId: buildStoredModelId(provider.id, model.id),
        providerId: provider.id,
        providerName: provider.name,
        name: normalizedName.length > 0 ? normalizedName : model.id,
        contextWindow: model.limit.context,
        supportsReasoning:
          Boolean(model.capabilities?.reasoning) || collectVariantNames(model.variants).length > 0,
        reasoningVariants: buildReasoningVariants(model),
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

export const findModelOptionByStoredId = (
  items: ReadonlyArray<WorkspaceModelOption>,
  storedId: string | undefined,
): WorkspaceModelOption | undefined => {
  return items.find((item) => item.storedId === storedId);
};

export const resolveReasoningVariant = (
  item: WorkspaceModelOption | undefined,
  reasoningLevel: ReasoningLevel | undefined,
): string | undefined => {
  if (!item?.supportsReasoning || reasoningLevel === undefined) {
    return undefined;
  }

  return item.reasoningVariants[reasoningLevel] ?? reasoningLevel;
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
