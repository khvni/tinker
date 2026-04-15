import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '@tinker/shared-types';
import { buildMemoryContext, injectMemoryContext } from './memory-injector.js';

const makeEntity = (overrides: Partial<Entity>): Entity => ({
  id: 'vault:People/Jane Smith.md',
  kind: 'person',
  name: 'Jane Smith',
  aliases: [],
  sources: [{ integration: 'vault', externalId: 'People/Jane Smith.md' }],
  attributes: {
    relativePath: 'People/Jane Smith.md',
    excerpt: 'Leads [[Q2 Launch]] and owns launch checklist.',
    links: ['Q2 Launch'],
  },
  lastSeenAt: '2026-04-15T00:00:00.000Z',
  ...overrides,
});

describe('buildMemoryContext', () => {
  it('returns null when entity list is empty', () => {
    expect(buildMemoryContext([])).toBeNull();
  });

  it('renders path, excerpt, and wikilinks', () => {
    const text = buildMemoryContext([makeEntity({})]);

    expect(text).not.toBeNull();
    expect(text).toContain('path=People/Jane Smith.md');
    expect(text).toContain('excerpt: Leads [[Q2 Launch]]');
    expect(text).toContain('links: [[Q2 Launch]]');
  });
});

describe('injectMemoryContext', () => {
  it('sends rendered memory as noReply prompt', async () => {
    const session = { prompt: vi.fn().mockResolvedValue(undefined) };

    await injectMemoryContext({ session } as never, 'session-1', [makeEntity({})]);

    expect(session.prompt).toHaveBeenCalledTimes(1);
    const call = session.prompt.mock.calls[0]?.[0] as {
      sessionID: string;
      noReply: boolean;
      parts: Array<{ text: string }>;
    };
    expect(call.sessionID).toBe('session-1');
    expect(call.noReply).toBe(true);
    expect(call.parts[0]?.text).toContain('Relevant local memory:');
  });
});
