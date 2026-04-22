import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@tinker/shared-types';
import { getDatabase } from './database.js';
import {
  getUser,
  getUserByProvider,
  hydrateUserRow,
  listUsersByLastSeen,
  migrateLocalUserIdentity,
  updateLastSeen,
  upsertUser,
  type UserRow,
} from './user-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type FakeDatabase = {
  execute: (query: string, bindValues?: unknown[]) => Promise<void>;
  select: <TRow>(query: string, bindValues?: unknown[]) => Promise<TRow>;
};

const BASE_USER: User = {
  id: 'google:user-123',
  provider: 'google',
  providerUserId: 'user-123',
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://example.com/ada.png',
  email: 'ada@example.com',
  createdAt: '2026-04-21T00:00:00.000Z',
  lastSeenAt: '2026-04-21T00:00:00.000Z',
};

const toRow = (user: User): UserRow => ({
  id: user.id,
  provider: user.provider,
  provider_user_id: user.providerUserId,
  display_name: user.displayName,
  avatar_url: user.avatarUrl ?? null,
  email: user.email ?? null,
  created_at: user.createdAt,
  last_seen_at: user.lastSeenAt,
});

const createFakeDatabase = (): FakeDatabase => {
  const rows = new Map<string, UserRow>();
  const providerIndex = new Map<string, string>();
  const sortedRows = (): UserRow[] => {
    return Array.from(rows.values()).sort((left, right) => {
      const byLastSeen = right.last_seen_at.localeCompare(left.last_seen_at);
      if (byLastSeen !== 0) {
        return byLastSeen;
      }

      const byCreatedAt = right.created_at.localeCompare(left.created_at);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }

      return left.id.localeCompare(right.id);
    });
  };

  return {
    async execute(query: string, bindValues?: unknown[]): Promise<void> {
      if (query.includes('INSERT INTO users')) {
        const [
          id,
          provider,
          providerUserId,
          displayName,
          avatarUrl,
          email,
          createdAt,
          lastSeenAt,
        ] = (bindValues ?? []) as [
          string,
          User['provider'],
          string,
          string,
          string | null,
          string | null,
          string,
          string,
        ];
        const providerKey = `${provider}:${providerUserId}`;
        const existingId = providerIndex.get(providerKey);

        if (existingId) {
          const existing = rows.get(existingId);
          if (!existing) {
            throw new Error(`Missing existing row for ${providerKey}.`);
          }

          rows.set(existingId, {
            ...existing,
            display_name: displayName,
            avatar_url: avatarUrl,
            email,
            last_seen_at: lastSeenAt,
          });
          return;
        }

        rows.set(id, {
          id,
          provider,
          provider_user_id: providerUserId,
          display_name: displayName,
          avatar_url: avatarUrl,
          email,
          created_at: createdAt,
          last_seen_at: lastSeenAt,
        });
        providerIndex.set(providerKey, id);
        return;
      }

      if (query.includes('UPDATE users')) {
        const [id, lastSeenAt] = (bindValues ?? []) as [string, string];
        const existing = rows.get(id);
        if (!existing) {
          return;
        }

        rows.set(id, {
          ...existing,
          last_seen_at: lastSeenAt,
        });
        return;
      }

      throw new Error(`Unexpected execute query: ${query}`);
    },

    async select<TRow>(query: string, bindValues?: unknown[]): Promise<TRow> {
      if (query.includes('ORDER BY last_seen_at DESC')) {
        return sortedRows() as TRow;
      }

      if (query.includes('WHERE id = $1')) {
        const [id] = (bindValues ?? []) as [string];
        const row = rows.get(id);
        return (row ? [row] : []) as TRow;
      }

      if (query.includes('WHERE provider = $1')) {
        const [provider, providerUserId] = (bindValues ?? []) as [User['provider'], string];
        const id = providerIndex.get(`${provider}:${providerUserId}`);
        const row = id ? rows.get(id) : undefined;
        return (row ? [row] : []) as TRow;
      }

      throw new Error(`Unexpected select query: ${query}`);
    },
  };
};

describe('hydrateUserRow', () => {
  it('returns null when row is missing', () => {
    expect(hydrateUserRow(undefined)).toBeNull();
  });

  it('maps database columns to the shared User shape', () => {
    expect(hydrateUserRow(toRow(BASE_USER))).toEqual(BASE_USER);
  });
});

describe('user-store helpers', () => {
  const getDatabaseMock = vi.mocked(getDatabase);

  beforeEach(() => {
    getDatabaseMock.mockReset();
    getDatabaseMock.mockResolvedValue(createFakeDatabase() as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('inserts a signed-in user and fetches it by id and provider identity', async () => {
    await upsertUser(BASE_USER);

    await expect(getUser(BASE_USER.id)).resolves.toEqual(BASE_USER);
    await expect(getUserByProvider(BASE_USER.provider, BASE_USER.providerUserId)).resolves.toEqual(BASE_USER);
  });

  it('upserts repeat sign-ins onto the same provider identity and preserves createdAt', async () => {
    await upsertUser(BASE_USER);

    const updated: User = {
      ...BASE_USER,
      id: 'google:replacement-id',
      displayName: 'Ada Byron',
      lastSeenAt: '2026-04-22T12:34:56.000Z',
    };

    await upsertUser(updated);

    await expect(getUserByProvider(updated.provider, updated.providerUserId)).resolves.toEqual({
      ...BASE_USER,
      displayName: 'Ada Byron',
      lastSeenAt: '2026-04-22T12:34:56.000Z',
    });
    await expect(getUser(updated.id)).resolves.toBeNull();
  });

  it('updates last_seen_at without mutating other fields', async () => {
    await upsertUser(BASE_USER);

    await updateLastSeen(BASE_USER.id, '2026-04-23T00:00:00.000Z');

    await expect(getUser(BASE_USER.id)).resolves.toEqual({
      ...BASE_USER,
      lastSeenAt: '2026-04-23T00:00:00.000Z',
    });
  });

  it('lists users by descending last_seen_at with stable tie-breaks', async () => {
    const olderUser: User = {
      ...BASE_USER,
      id: 'github:user-456',
      provider: 'github',
      providerUserId: 'user-456',
      createdAt: '2026-04-20T00:00:00.000Z',
      lastSeenAt: '2026-04-20T00:00:00.000Z',
      email: 'hopper@example.com',
      displayName: 'Grace Hopper',
    };
    const newerUser: User = {
      ...BASE_USER,
      id: 'microsoft:user-789',
      provider: 'microsoft',
      providerUserId: 'user-789',
      createdAt: '2026-04-22T00:00:00.000Z',
      lastSeenAt: '2026-04-22T00:00:00.000Z',
      email: 'lamarr@example.com',
      displayName: 'Hedy Lamarr',
    };

    await upsertUser(olderUser);
    await upsertUser(newerUser);
    await upsertUser(BASE_USER);

    await expect(listUsersByLastSeen()).resolves.toEqual([newerUser, BASE_USER, olderUser]);
  });
});

describe('migrateLocalUserIdentity', () => {
  const getDatabaseMock = vi.mocked(getDatabase);

  type MigrationTables = {
    users: Map<string, { id: string; providerUserId: string }>;
    layouts: Set<string>;
    sessions: Map<string, string>;
  };

  const createMigrationDatabase = (initial: MigrationTables) => {
    const executes: Array<{ query: string; bind: unknown[] }> = [];
    return {
      executes,
      db: {
        async execute(query: string, bindValues?: unknown[]): Promise<void> {
          const bind = bindValues ?? [];
          executes.push({ query, bind });

          if (query.startsWith('UPDATE users SET id')) {
            const [newId, legacyId] = bind as [string, string];
            const existing = initial.users.get(legacyId);
            if (!existing) return;
            initial.users.delete(legacyId);
            initial.users.set(newId, { id: newId, providerUserId: newId });
            return;
          }

          if (query.startsWith('UPDATE layouts')) {
            const [newId, legacyId] = bind as [string, string];
            if (initial.layouts.delete(legacyId)) {
              initial.layouts.add(newId);
            }
            return;
          }

          if (query.startsWith('UPDATE sessions')) {
            const [newId, legacyId] = bind as [string, string];
            for (const [sessionId, userId] of initial.sessions) {
              if (userId === legacyId) {
                initial.sessions.set(sessionId, newId);
              }
            }
            return;
          }

          throw new Error(`Unexpected migration execute: ${query}`);
        },

        async select<TRow>(query: string, bindValues?: unknown[]): Promise<TRow> {
          if (query.includes('SELECT id FROM users')) {
            const [id] = (bindValues ?? []) as [string];
            const existing = initial.users.get(id);
            return (existing ? [{ id: existing.id }] : []) as TRow;
          }
          throw new Error(`Unexpected migration select: ${query}`);
        },
      },
    };
  };

  beforeEach(() => {
    getDatabaseMock.mockReset();
  });

  it('renames legacy local user and its layouts + sessions to new id', async () => {
    const tables: MigrationTables = {
      users: new Map([['local-user', { id: 'local-user', providerUserId: 'local-user' }]]),
      layouts: new Set(['local-user']),
      sessions: new Map([['sess-1', 'local-user']]),
    };
    const { db } = createMigrationDatabase(tables);
    getDatabaseMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDatabase>>);

    await migrateLocalUserIdentity('local-user', 'guest');

    expect(tables.users.has('local-user')).toBe(false);
    expect(tables.users.get('guest')).toEqual({ id: 'guest', providerUserId: 'guest' });
    expect(tables.layouts.has('guest')).toBe(true);
    expect(tables.sessions.get('sess-1')).toBe('guest');
  });

  it('no-ops when new id already exists', async () => {
    const tables: MigrationTables = {
      users: new Map([
        ['local-user', { id: 'local-user', providerUserId: 'local-user' }],
        ['guest', { id: 'guest', providerUserId: 'guest' }],
      ]),
      layouts: new Set(['local-user', 'guest']),
      sessions: new Map(),
    };
    const { db, executes } = createMigrationDatabase(tables);
    getDatabaseMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDatabase>>);

    await migrateLocalUserIdentity('local-user', 'guest');

    expect(executes).toHaveLength(0);
    expect(tables.users.has('local-user')).toBe(true);
    expect(tables.users.has('guest')).toBe(true);
  });

  it('no-ops when legacy id is missing', async () => {
    const tables: MigrationTables = {
      users: new Map(),
      layouts: new Set(),
      sessions: new Map(),
    };
    const { db, executes } = createMigrationDatabase(tables);
    getDatabaseMock.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDatabase>>);

    await migrateLocalUserIdentity('local-user', 'guest');

    expect(executes).toHaveLength(0);
  });
});
