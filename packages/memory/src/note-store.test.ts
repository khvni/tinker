import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getDatabase } from './database.js';
import { createNoteStore, listNoteContextSources } from './note-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type SelectFn = (query: string, bindValues?: unknown[]) => Promise<unknown>;
type ExecuteFn = (query: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number }>;

type MockDatabase = {
  select: Mock<SelectFn>;
  execute: Mock<ExecuteFn>;
};

const createMockDatabase = (): MockDatabase => ({
  select: vi.fn<SelectFn>().mockResolvedValue([]),
  execute: vi.fn<ExecuteFn>().mockResolvedValue({ rowsAffected: 1 }),
});

let mockDb: MockDatabase;

beforeEach(() => {
  mockDb = createMockDatabase();
  vi.mocked(getDatabase).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDatabase>>);
});

describe('createNoteStore', () => {
  describe('create', () => {
    it('inserts a new note and returns it', async () => {
      const store = createNoteStore();
      const note = await store.create('My Note', 'Hello world');

      expect(note.title).toBe('My Note');
      expect(note.body).toBe('Hello world');
      expect(note.contextEnabled).toBe(true);
      expect(note.id).toMatch(/^[0-9a-f-]{36}$/u);
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('inserts into notes_fts for full-text search', async () => {
      const store = createNoteStore();
      await store.create('Test', 'body');

      const ftsCall = mockDb.execute.mock.calls[1];
      expect(ftsCall?.[0]).toContain('notes_fts');
    });
  });

  describe('get', () => {
    it('returns null for a non-existent note', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const store = createNoteStore();
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    it('returns the note when found', async () => {
      mockDb.select.mockResolvedValueOnce([{
        id: 'abc',
        title: 'Found',
        body: 'content',
        context_enabled: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }]);
      const store = createNoteStore();
      const result = await store.get('abc');

      expect(result).toEqual({
        id: 'abc',
        title: 'Found',
        body: 'content',
        contextEnabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });
  });

  describe('list', () => {
    it('returns empty array when no notes exist', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const store = createNoteStore();
      const result = await store.list();
      expect(result).toEqual([]);
    });

    it('returns list entries with excerpts', async () => {
      mockDb.select.mockResolvedValueOnce([{
        id: 'n1',
        title: 'First',
        body: 'Short content',
        context_enabled: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }]);
      const store = createNoteStore();
      const result = await store.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('First');
      expect(result[0]?.excerpt).toBe('Short content');
    });
  });

  describe('search', () => {
    it('falls back to list when query is empty', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const store = createNoteStore();
      await store.search('   ');

      const query = mockDb.select.mock.calls[0]?.[0] as string;
      expect(query).toContain('ORDER BY updated_at DESC');
      expect(query).not.toContain('MATCH');
    });

    it('performs FTS match for non-empty queries', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const store = createNoteStore();
      await store.search('hello world');

      const query = mockDb.select.mock.calls[0]?.[0] as string;
      expect(query).toContain('MATCH');
    });
  });

  describe('update', () => {
    it('returns null if note does not exist', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const store = createNoteStore();
      const result = await store.update('missing', { title: 'New' });
      expect(result).toBeNull();
    });

    it('updates only provided fields', async () => {
      mockDb.select.mockResolvedValueOnce([{
        id: 'u1',
        title: 'Original',
        body: 'Original body',
        context_enabled: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }]);
      const store = createNoteStore();
      const result = await store.update('u1', { title: 'Updated' });

      expect(result?.title).toBe('Updated');
      expect(result?.body).toBe('Original body');
      expect(result?.contextEnabled).toBe(true);
    });

    it('can disable context', async () => {
      mockDb.select.mockResolvedValueOnce([{
        id: 'u2',
        title: 'Note',
        body: 'body',
        context_enabled: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }]);
      const store = createNoteStore();
      const result = await store.update('u2', { contextEnabled: false });
      expect(result?.contextEnabled).toBe(false);

      const updateCall = mockDb.execute.mock.calls[0];
      expect(updateCall?.[1]).toContain(0);
    });
  });

  describe('remove', () => {
    it('returns false when note does not exist', async () => {
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 0 });
      const store = createNoteStore();
      const result = await store.remove('missing');
      expect(result).toBe(false);
    });

    it('returns true and deletes FTS entry', async () => {
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 });
      const store = createNoteStore();
      const result = await store.remove('del1');
      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });
  });
});

describe('listNoteContextSources', () => {
  it('returns empty array when no enabled notes exist', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await listNoteContextSources();
    expect(result).toEqual([]);
  });

  it('returns context sources with provenance for enabled notes', async () => {
    mockDb.select.mockResolvedValueOnce([{
      id: 'ctx1',
      title: 'Context note',
      body: 'This is the content for context retrieval',
      context_enabled: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    }]);

    const result = await listNoteContextSources();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'note:ctx1',
      kind: 'note',
      title: 'Context note',
      excerpt: 'This is the content for context retrieval',
      body: 'This is the content for context retrieval',
      provenance: {
        sourceId: 'ctx1',
        sourceKind: 'note',
        title: 'Context note',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('only returns context_enabled=1 notes', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    await listNoteContextSources();

    const query = mockDb.select.mock.calls[0]?.[0] as string;
    expect(query).toContain('context_enabled = 1');
  });
});
