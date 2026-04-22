import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceMetadataApi } from './metadata.js';
import type { WorkspaceCardModel } from './types.js';

const createSeedCard = (overrides: Partial<WorkspaceCardModel> = {}): WorkspaceCardModel => ({
  id: 'seed',
  title: 'Seed workspace',
  pinned: false,
  attention: { unread: false, flash: null },
  entries: [
    {
      key: 'git.branch',
      value: 'main',
      priority: 10,
      format: 'plain',
      timestamp: 50,
    },
  ],
  ...overrides,
});

describe('createWorkspaceMetadataApi', () => {
  it('returns initial cards from GET /workspace.cards', async () => {
    const api = createWorkspaceMetadataApi({
      initialCards: [
        createSeedCard({ id: 'alpha', title: 'Alpha', entries: [{ key: 'last.active', value: '1m ago', priority: 1, format: 'plain', timestamp: 10 }] }),
        createSeedCard({ id: 'beta', title: 'Beta', pinned: true, entries: [{ key: 'last.active', value: 'just now', priority: 1, format: 'plain', timestamp: 20 }] }),
      ],
    });

    const response = await api.getWorkspaceCards();

    expect(response.cards.map((card) => card.id)).toEqual(['beta', 'alpha']);
  });

  it('creates a card from POST /workspace.metadata with workspace fallback title', async () => {
    const api = createWorkspaceMetadataApi({ now: () => 100 });

    const response = await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [
        {
          key: 'git.branch',
          value: 'feat/sidebar',
          priority: 20,
        },
      ],
    });

    expect(response.card).toEqual({
      id: 'workspace-1',
      title: 'workspace-1',
      pinned: false,
      attention: { unread: false, flash: null },
      entries: [
        {
          key: 'git.branch',
          value: 'feat/sidebar',
          priority: 20,
          format: 'plain',
          timestamp: 100,
        },
      ],
    });
  });

  it('replaces existing entry values while preserving metadata when omitted', async () => {
    const api = createWorkspaceMetadataApi({ now: () => 200 });

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      title: 'Workspace One',
      entries: [
        {
          key: 'git.branch',
          value: 'main',
          priority: 30,
          color: 'accent.base',
        },
      ],
    });

    const response = await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [
        {
          key: 'git.branch',
          value: 'feat/sidebar',
        },
      ],
    });

    expect(response.card.entries).toEqual([
      {
        key: 'git.branch',
        value: 'feat/sidebar',
        priority: 30,
        format: 'plain',
        timestamp: 200,
        color: 'accent.base',
      },
    ]);
  });

  it('removes entries via removeEntryKeys and blank values', async () => {
    const api = createWorkspaceMetadataApi({ now: () => 300 });

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [
        { key: 'git.branch', value: 'main', priority: 10 },
        { key: 'git.pr', value: '#42', priority: 20 },
      ],
    });

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      removeEntryKeys: ['git.pr'],
      entries: [{ key: 'git.branch', value: '   ' }],
    });

    const response = await api.getWorkspaceCards();

    expect(response.cards[0]?.entries).toEqual([]);
  });

  it('updates card order from pinning and fresh metadata timestamps', async () => {
    let tick = 10;
    const api = createWorkspaceMetadataApi({ now: () => tick });

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-a',
      title: 'A',
      entries: [{ key: 'last.active', value: 'earlier', priority: 10 }],
    });

    tick = 20;
    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-b',
      title: 'B',
      entries: [{ key: 'last.active', value: 'later', priority: 10 }],
    });

    let response = await api.getWorkspaceCards();
    expect(response.cards.map((card) => card.id)).toEqual(['workspace-b', 'workspace-a']);

    tick = 30;
    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-a',
      pinned: true,
    });

    response = await api.getWorkspaceCards();
    expect(response.cards.map((card) => card.id)).toEqual(['workspace-a', 'workspace-b']);
  });

  it('notifies subscribers on mutation and stops after unsubscribe', async () => {
    const api = createWorkspaceMetadataApi({ now: () => 400 });
    const listener = vi.fn();
    const unsubscribe = api.subscribe(listener);

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [{ key: 'git.branch', value: 'main', priority: 10 }],
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0][0]?.id).toBe('workspace-1');

    unsubscribe();

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [{ key: 'git.branch', value: 'feat/sidebar', priority: 10 }],
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears cards on reset', async () => {
    const api = createWorkspaceMetadataApi({ now: () => 500 });

    await api.postWorkspaceMetadata({
      workspaceId: 'workspace-1',
      entries: [{ key: 'git.branch', value: 'main', priority: 10 }],
    });

    await api.reset();

    const response = await api.getWorkspaceCards();
    expect(response.cards).toEqual([]);
  });

  it('rejects blank workspace ids', async () => {
    const api = createWorkspaceMetadataApi();

    await expect(
      api.postWorkspaceMetadata({
        workspaceId: '   ',
      }),
    ).rejects.toThrow('workspaceId is required for POST /workspace.metadata.');
  });
});
