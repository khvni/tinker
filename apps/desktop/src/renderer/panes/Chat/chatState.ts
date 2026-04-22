import type { WorkspaceModelOption } from '../../opencode.js';
import type { Block } from './Block.js';

export const CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD = 100;

export type ContextUsageTokens = {
  readonly total?: number;
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
};

export type ContextUsageSnapshot = {
  readonly providerID: string | null;
  readonly modelID: string | null;
  readonly tokens: ContextUsageTokens;
};

export type ResolvedContextUsage = {
  readonly percent: number;
  readonly tokens: number;
  readonly windowSize: number;
  readonly model: string;
};

type ScrollMetrics = {
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly scrollTop: number;
};

const getBlockSignature = (block: Block): string => {
  if (block.kind === 'text' || block.kind === 'reasoning') {
    return `${block.partID}:${block.kind}:${block.text}`;
  }

  return `${block.partID}:${block.kind}:${block.state}:${block.output ?? ''}:${block.error ?? ''}`;
};

const resolveUsageModel = (
  usage: ContextUsageSnapshot,
  modelOptions: ReadonlyArray<WorkspaceModelOption>,
  fallbackModel: WorkspaceModelOption | undefined,
): WorkspaceModelOption | undefined => {
  if (usage.providerID && usage.modelID) {
    const resolved = modelOptions.find(
      (option) => option.providerId === usage.providerID && option.modelId === usage.modelID,
    );
    if (resolved) {
      return resolved;
    }
  }

  if (
    fallbackModel
    && (!usage.providerID || usage.providerID === fallbackModel.providerId)
    && (!usage.modelID || usage.modelID === fallbackModel.modelId)
  ) {
    return fallbackModel;
  }

  return undefined;
};

export const isScrolledNearBottom = (
  metrics: ScrollMetrics,
  threshold = CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD,
): boolean => {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= threshold;
};

export const getChatTailSignature = (
  messageBlocks: readonly Block[],
  draftBlocks: readonly Block[],
): string => {
  const lastBlock = draftBlocks.at(-1) ?? messageBlocks.at(-1);
  if (!lastBlock) {
    return 'empty';
  }

  return getBlockSignature(lastBlock);
};

export const getContextTokenTotal = (tokens: ContextUsageTokens): number => {
  const total = tokens.total ?? tokens.input + tokens.output + tokens.reasoning;
  return Number.isFinite(total) ? total : 0;
};

export const resolveContextUsage = (input: {
  readonly usage: ContextUsageSnapshot;
  readonly modelOptions: ReadonlyArray<WorkspaceModelOption>;
  readonly fallbackModel: WorkspaceModelOption | undefined;
}): ResolvedContextUsage | null => {
  const resolvedModel = resolveUsageModel(input.usage, input.modelOptions, input.fallbackModel);
  const windowSize = resolvedModel?.contextWindow;
  if (!windowSize || !Number.isFinite(windowSize) || windowSize <= 0) {
    return null;
  }

  const tokens = getContextTokenTotal(input.usage.tokens);
  return {
    percent: (tokens / windowSize) * 100,
    tokens,
    windowSize,
    model: resolvedModel.name,
  };
};

export const sameResolvedContextUsage = (
  left: ResolvedContextUsage | null,
  right: ResolvedContextUsage | null,
): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.percent === right.percent
    && left.tokens === right.tokens
    && left.windowSize === right.windowSize
    && left.model === right.model
  );
};
