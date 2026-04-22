import { describe, expect, it } from 'vitest';
import {
  buildModelPickerItems,
  findModelOptionById,
  findModelOptionByStoredId,
  pickDefaultModelOptionId,
  pickFirstOauthProvider,
  resolveReasoningVariant,
} from './opencode.js';

const providers = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: {
      'claude-sonnet-4': {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4 (latest)',
        limit: { context: 200_000 },
        capabilities: { reasoning: true },
        variants: ['low', 'medium', 'high'],
      },
      'claude-haiku-4': {
        id: 'claude-haiku-4',
        name: 'Claude Haiku 4',
        limit: { context: 200_000 },
      },
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: {
      'gpt-4.1': {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        limit: { context: 128_000 },
      },
    },
  },
] as const;

describe('buildModelPickerItems', () => {
  it('flattens provider config into picker rows', () => {
    expect(buildModelPickerItems(providers)).toEqual([
      {
        id: 'anthropic:claude-sonnet-4',
        modelId: 'claude-sonnet-4',
        storedId: 'anthropic/claude-sonnet-4',
        providerId: 'anthropic',
        providerName: 'Anthropic',
        name: 'Claude Sonnet 4',
        contextWindow: 200_000,
        supportsReasoning: true,
        reasoningVariants: {
          low: 'low',
          medium: 'medium',
          high: 'high',
        },
      },
      {
        id: 'anthropic:claude-haiku-4',
        modelId: 'claude-haiku-4',
        storedId: 'anthropic/claude-haiku-4',
        providerId: 'anthropic',
        providerName: 'Anthropic',
        name: 'Claude Haiku 4',
        contextWindow: 200_000,
        supportsReasoning: false,
        reasoningVariants: {},
      },
      {
        id: 'openai:gpt-4.1',
        modelId: 'gpt-4.1',
        storedId: 'openai/gpt-4.1',
        providerId: 'openai',
        providerName: 'OpenAI',
        name: 'GPT-4.1',
        contextWindow: 128_000,
        supportsReasoning: false,
        reasoningVariants: {},
      },
    ]);
  });
});

describe('pickDefaultModelOptionId', () => {
  it('uses OpenCode default provider/model mapping when present', () => {
    expect(pickDefaultModelOptionId(providers, { openai: 'gpt-4.1' })).toBe('openai:gpt-4.1');
  });

  it('falls back to the first picker option when defaults are missing', () => {
    expect(pickDefaultModelOptionId(providers, {})).toBe('anthropic:claude-sonnet-4');
  });
});

describe('findModelOptionById', () => {
  it('returns the selected row metadata for prompt overrides', () => {
    const items = buildModelPickerItems(providers);

    expect(findModelOptionById(items, 'anthropic:claude-haiku-4')).toEqual({
      id: 'anthropic:claude-haiku-4',
      modelId: 'claude-haiku-4',
      storedId: 'anthropic/claude-haiku-4',
      providerId: 'anthropic',
      providerName: 'Anthropic',
      name: 'Claude Haiku 4',
      contextWindow: 200_000,
      supportsReasoning: false,
      reasoningVariants: {},
    });
  });
});

describe('findModelOptionByStoredId', () => {
  it('matches persisted provider/model ids from SQLite', () => {
    const items = buildModelPickerItems(providers);

    expect(findModelOptionByStoredId(items, 'anthropic/claude-sonnet-4')?.id).toBe(
      'anthropic:claude-sonnet-4',
    );
  });
});

describe('resolveReasoningVariant', () => {
  it('returns the OpenCode variant matching the selected reasoning level', () => {
    const items = buildModelPickerItems(providers);
    const model = findModelOptionByStoredId(items, 'anthropic/claude-sonnet-4');

    expect(resolveReasoningVariant(model, 'high')).toBe('high');
  });

  it('returns undefined for non-reasoning models', () => {
    const items = buildModelPickerItems(providers);
    const model = findModelOptionByStoredId(items, 'openai/gpt-4.1');

    expect(resolveReasoningVariant(model, 'medium')).toBeUndefined();
  });
});

describe('pickFirstOauthProvider', () => {
  it('selects the first configured provider with an OAuth method', () => {
    expect(
      pickFirstOauthProvider(providers, {
        anthropic: [{ type: 'api-key' }],
        openai: [{ type: 'oauth' }, { type: 'api-key' }],
      }),
    ).toEqual({ providerId: 'openai', methodIndex: 0 });
  });

  it('returns null when OpenCode exposes no OAuth-capable provider', () => {
    expect(
      pickFirstOauthProvider(providers, {
        anthropic: [{ type: 'api-key' }],
        openai: [{ type: 'manual' }],
      }),
    ).toBeNull();
  });
});
