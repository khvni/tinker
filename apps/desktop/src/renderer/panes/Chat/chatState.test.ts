import { describe, expect, it } from 'vitest';
import type { Block } from './Block.js';
import {
  CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD,
  getChatTailSignature,
  getContextTokenTotal,
  isScrolledNearBottom,
  resolveContextUsage,
  sameResolvedContextUsage,
  type ContextUsageSnapshot,
} from './chatState.js';

const modelOptions = [
  {
    id: 'anthropic:claude-sonnet-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    modelId: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    contextWindow: 200_000,
  },
] as const;

describe('isScrolledNearBottom', () => {
  it('treats distances within threshold as sticky', () => {
    expect(
      isScrolledNearBottom({
        scrollTop: 700,
        clientHeight: 300,
        scrollHeight: 1_050,
      }),
    ).toBe(true);
  });

  it('treats distances beyond threshold as scrolled up', () => {
    expect(
      isScrolledNearBottom({
        scrollTop: 600,
        clientHeight: 300,
        scrollHeight: 1_050,
      }),
    ).toBe(false);
  });

  it('exports the spec threshold', () => {
    expect(CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD).toBe(100);
  });
});

describe('getChatTailSignature', () => {
  it('prefers draft blocks so streaming deltas trigger tail changes', () => {
    const history: Block[] = [{ kind: 'text', partID: 'm1', text: 'older' }];
    const draft: Block[] = [{ kind: 'text', partID: 'draft-1', text: 'partial' }];

    expect(getChatTailSignature(history, draft)).toBe('draft-1:text:partial');
  });

  it('ignores prepended history when last visible block is unchanged', () => {
    const newerHistory: Block[] = [
      { kind: 'text', partID: 'm0', text: 'prepended older' },
      { kind: 'text', partID: 'm1', text: 'latest' },
    ];
    const priorHistory: Block[] = [{ kind: 'text', partID: 'm1', text: 'latest' }];

    expect(getChatTailSignature(newerHistory, [])).toBe(getChatTailSignature(priorHistory, []));
  });
});

describe('getContextTokenTotal', () => {
  it('prefers reported totals when present', () => {
    expect(
      getContextTokenTotal({
        total: 4_200,
        input: 4_000,
        output: 150,
        reasoning: 50,
      }),
    ).toBe(4_200);
  });

  it('falls back to input + output + reasoning', () => {
    expect(
      getContextTokenTotal({
        input: 4_000,
        output: 150,
        reasoning: 50,
      }),
    ).toBe(4_200);
  });
});

describe('resolveContextUsage', () => {
  const usage: ContextUsageSnapshot = {
    providerID: 'anthropic',
    modelID: 'claude-sonnet-4',
    tokens: {
      total: 80_000,
      input: 79_000,
      output: 900,
      reasoning: 100,
    },
  };

  it('resolves percent/window/model from provider + model ids', () => {
    expect(
      resolveContextUsage({
        usage,
        modelOptions,
        fallbackModel: undefined,
      }),
    ).toEqual({
      percent: 40,
      tokens: 80_000,
      windowSize: 200_000,
      model: 'Claude Sonnet 4',
    });
  });

  it('falls back to selected model when streaming usage lacks model ids', () => {
    expect(
      resolveContextUsage({
        usage: {
          providerID: null,
          modelID: null,
          tokens: {
            input: 48_000,
            output: 1_000,
            reasoning: 1_000,
          },
        },
        modelOptions,
        fallbackModel: modelOptions[0],
      }),
    ).toEqual({
      percent: 25,
      tokens: 50_000,
      windowSize: 200_000,
      model: 'Claude Sonnet 4',
    });
  });

  it('returns null when no context window can be resolved', () => {
    expect(
      resolveContextUsage({
        usage,
        modelOptions: [],
        fallbackModel: undefined,
      }),
    ).toBeNull();
  });
});

describe('sameResolvedContextUsage', () => {
  it('compares null and scalar fields safely', () => {
    expect(sameResolvedContextUsage(null, null)).toBe(true);
    expect(
      sameResolvedContextUsage(
        {
          percent: 50,
          tokens: 100_000,
          windowSize: 200_000,
          model: 'Claude Sonnet 4',
        },
        {
          percent: 50,
          tokens: 100_000,
          windowSize: 200_000,
          model: 'Claude Sonnet 4',
        },
      ),
    ).toBe(true);
    expect(
      sameResolvedContextUsage(
        {
          percent: 50,
          tokens: 100_000,
          windowSize: 200_000,
          model: 'Claude Sonnet 4',
        },
        null,
      ),
    ).toBe(false);
  });
});
