import { describe, expect, it } from 'vitest';
import { resolvePreferredStoredModelId, resolveSelectedModelId } from './modelSelection.js';

const options = [
  {
    id: 'anthropic:claude-sonnet-4',
    modelId: 'claude-sonnet-4',
    storedId: 'anthropic/claude-sonnet-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Sonnet 4',
    contextWindow: 200_000,
    supportsReasoning: true,
    reasoningVariants: { low: 'low', medium: 'medium', high: 'high' },
  },
  {
    id: 'openai:gpt-5',
    modelId: 'gpt-5',
    storedId: 'openai/gpt-5',
    providerId: 'openai',
    providerName: 'OpenAI',
    name: 'GPT-5',
    contextWindow: 1_000_000,
    supportsReasoning: false,
    reasoningVariants: {},
  },
] as const;

describe('resolvePreferredStoredModelId', () => {
  it('prefers the current folder session model when present', () => {
    expect(
      resolvePreferredStoredModelId(
        { modelId: 'anthropic/claude-sonnet-4' },
        [{ modelId: 'openai/gpt-5' }],
      ),
    ).toBe('anthropic/claude-sonnet-4');
  });

  it('falls back to the latest user session with a stored model', () => {
    expect(
      resolvePreferredStoredModelId(null, [{}, { modelId: 'openai/gpt-5' }]),
    ).toBe('openai/gpt-5');
  });
});

describe('resolveSelectedModelId', () => {
  it('preserves the active selection while a session is already open', () => {
    expect(
      resolveSelectedModelId({
        options,
        currentSelectedId: 'openai:gpt-5',
        preserveCurrent: true,
        preferredStoredModelId: 'anthropic/claude-sonnet-4',
        defaultSelectedId: 'anthropic:claude-sonnet-4',
      }),
    ).toBe('openai:gpt-5');
  });

  it('uses the preferred persisted model before the OpenCode default', () => {
    expect(
      resolveSelectedModelId({
        options,
        currentSelectedId: undefined,
        preserveCurrent: false,
        preferredStoredModelId: 'openai/gpt-5',
        defaultSelectedId: 'anthropic:claude-sonnet-4',
      }),
    ).toBe('openai:gpt-5');
  });

  it('falls back to the OpenCode default when no persisted model exists', () => {
    expect(
      resolveSelectedModelId({
        options,
        currentSelectedId: undefined,
        preserveCurrent: false,
        preferredStoredModelId: undefined,
        defaultSelectedId: 'anthropic:claude-sonnet-4',
      }),
    ).toBe('anthropic:claude-sonnet-4');
  });
});
