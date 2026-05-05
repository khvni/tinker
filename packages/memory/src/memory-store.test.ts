import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from './database.js';
import { flagEntitiesWithoutSources, pruneEntitiesWithoutSources } from './memory-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type ExecuteCall = { query: string; bindValues: unknown[] };

type FakeRow = {
  id: string;
  kind: string;
  name: string;
  aliases_json: string;
  sources_json: string;
  attributes_json: string;
  last_seen_at: string;
  stale_since?: string | null;
};

const buildRow = (overrides: Partial<FakeRow> & { id: string }): FakeRow => ({
  kind: 'note',
  name: overrides.id,
  aliases_json: '[]',
  sources_json: '[]',
  attributes_json: '{}',
  last_seen_at: '2026-04-21T00:00:00.000Z',
  stale_since: null,
  ...overrides,
});

const createFakeDatabase = (rows: FakeRow[]) => {
  const executeCalls: ExecuteCall[] = [];
  return {
    executeCalls,
    select: vi.fn(async (query: string) => {
      // Simulate `WHERE stale_since IS NULL` by filtering on the test rows.
      if (query.includes('WHERE stale_since IS NULL')) {
        return rows.filter((row) => row.stale_since == null);
      }
      return rows;
    }),
    execute: vi.fn(async (query: string, bindValues: unknown[] = []) => {
      executeCalls.push({ query, bindValues });
    }),
  };
};

describe('flagEntitiesWithoutSources', () => {
  beforeEach(() => {
    vi.mocked(getDatabase).mockReset();
  });

  it('flags entities with no sources and skips ones already flagged', async () => {
    const rows: FakeRow[] = [
      buildRow({ id: 'no-sources', sources_json: '[]', stale_since: null }),
      buildRow({
        id: 'has-vault',
        sources_json: JSON.stringify([
          { service: 'vault', ref: 'note.md', lastSeen: '2026-04-21T00:00:00.000Z' },
        ]),
      }),
      buildRow({ id: 'already-flagged', sources_json: '[]', stale_since: '2026-04-22T00:00:00.000Z' }),
    ];
    const fake = createFakeDatabase(rows);
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const flagged = await flagEntitiesWithoutSources(new Date('2026-04-22T03:00:00.000Z'));

    expect(flagged).toBe(1);
    const updateCalls = fake.executeCalls.filter((call) => call.query.includes('UPDATE entities'));
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.query).toContain('SET stale_since');
    expect(updateCalls[0]?.bindValues).toEqual(['2026-04-22T03:00:00.000Z', 'no-sources']);

    const deleteCalls = fake.executeCalls.filter((call) => call.query.includes('DELETE FROM entities'));
    expect(deleteCalls).toHaveLength(0);
  });

  it('returns zero and issues no UPDATE when every entity has sources', async () => {
    const rows: FakeRow[] = [
      buildRow({
        id: 'has-vault',
        sources_json: JSON.stringify([
          { service: 'vault', ref: 'note.md', lastSeen: '2026-04-21T00:00:00.000Z' },
        ]),
      }),
    ];
    const fake = createFakeDatabase(rows);
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const flagged = await flagEntitiesWithoutSources();
    expect(flagged).toBe(0);
    expect(fake.executeCalls).toHaveLength(0);
  });
});

describe('pruneEntitiesWithoutSources', () => {
  beforeEach(() => {
    vi.mocked(getDatabase).mockReset();
  });

  it('issues destructive deletes for the source-wipe path only', async () => {
    const rows: FakeRow[] = [
      buildRow({ id: 'no-sources', sources_json: '[]' }),
      buildRow({
        id: 'has-vault',
        sources_json: JSON.stringify([
          { service: 'vault', ref: 'note.md', lastSeen: '2026-04-21T00:00:00.000Z' },
        ]),
      }),
    ];
    const fake = createFakeDatabase(rows);
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const pruned = await pruneEntitiesWithoutSources();

    expect(pruned).toBe(1);
    const deleteCalls = fake.executeCalls.filter((call) => call.query.includes('DELETE FROM entities'));
    expect(deleteCalls.length).toBeGreaterThan(0);
    expect(deleteCalls[0]?.bindValues).toEqual(['no-sources']);
  });
});
