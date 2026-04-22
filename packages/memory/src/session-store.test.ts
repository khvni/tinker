import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@tinker/shared-types';
import { getDatabase } from './database.js';
import {
  createSession,
  deleteSession,
  getSession,
  hydrateSessionRow,
  listSessionsForUser,
  updateLastActive,
  type SessionRow,
} from './session-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type FakeDatabase = {
  execute: (query: string, bindValues?: unknown[]) => Promise<void>;
  select: <TRow>(query: string, bindValues?: unknown[]) => Promise<TRow>;
};

const BASE_SESSION: Session = {
  id: 'session-alpha',
  userId: 'google:user-123',
  folderPath: '/tmp/alpha',
  createdAt: '2026-04-21T00:00:00.000Z',
  lastActiveAt: '2026-04-21T00:10:00.000Z',
  modelId: 'openai/gpt-4.1',
};

const toRow = (session: Session): SessionRow => ({
  id: session.id,
  user_id: session.userId,
  folder_path: session.folderPath,
  created_at: session.createdAt,
  last_active_at: session.lastActiveAt,
  model_id: session.modelId ?? null,
});

const createFakeDatabase = (): FakeDatabase => {
  const sessions = new Map<string, SessionRow>();
  const userIds = new Set<Session['userId']>(['google:user-123', 'github:user-456']);

  return {
    async execute(query: string, bindValues?: unknown[]): Promise<void> {
      if (query.includes('INSERT INTO sessions')) {
        const [id, userId, folderPath, createdAt, lastActiveAt, modelId] = (bindValues ?? []) as [
          string,
          Session['userId'],
          string,
          string,
          string,
          string | null,
        ];

        if (!userIds.has(userId)) {
          throw new Error(`Unknown user ${userId}.`);
        }

        sessions.set(id, {
          id,
          user_id: userId,
          folder_path: folderPath,
          created_at: createdAt,
          last_active_at: lastActiveAt,
          model_id: modelId,
        });
        return;
      }

      if (query.includes('UPDATE sessions')) {
        const [id, lastActiveAt] = (bindValues ?? []) as [string, string];
        const existing = sessions.get(id);
        if (!existing) {
          return;
        }

        sessions.set(id, {
          ...existing,
          last_active_at: lastActiveAt,
        });
        return;
      }

      if (query.includes('DELETE FROM sessions')) {
        const [id] = (bindValues ?? []) as [string];
        sessions.delete(id);
        return;
      }

      throw new Error(`Unexpected execute query: ${query}`);
    },

    async select<TRow>(query: string, bindValues?: unknown[]): Promise<TRow> {
      if (query.includes('WHERE id = $1')) {
        const [id] = (bindValues ?? []) as [string];
        const session = sessions.get(id);
        return (session ? [session] : []) as TRow;
      }

      if (query.includes('WHERE user_id = $1')) {
        const [userId] = (bindValues ?? []) as [Session['userId']];
        const rows = Array.from(sessions.values())
          .filter((session) => session.user_id === userId)
          .sort((left, right) => {
            const byLastActive = right.last_active_at.localeCompare(left.last_active_at);
            if (byLastActive !== 0) {
              return byLastActive;
            }

            const byCreatedAt = right.created_at.localeCompare(left.created_at);
            if (byCreatedAt !== 0) {
              return byCreatedAt;
            }

            return left.id.localeCompare(right.id);
          });

        return rows as TRow;
      }

      throw new Error(`Unexpected select query: ${query}`);
    },
  };
};

describe('hydrateSessionRow', () => {
  it('returns null when row is missing', () => {
    expect(hydrateSessionRow(undefined)).toBeNull();
  });

  it('maps database columns to shared Session shape', () => {
    expect(hydrateSessionRow(toRow(BASE_SESSION))).toEqual(BASE_SESSION);
    expect(
      hydrateSessionRow({
        ...toRow(BASE_SESSION),
        model_id: null,
      }),
    ).toEqual({
      id: BASE_SESSION.id,
      userId: BASE_SESSION.userId,
      folderPath: BASE_SESSION.folderPath,
      createdAt: BASE_SESSION.createdAt,
      lastActiveAt: BASE_SESSION.lastActiveAt,
    });
  });
});

describe('session-store helpers', () => {
  const getDatabaseMock = vi.mocked(getDatabase);

  beforeEach(() => {
    getDatabaseMock.mockReset();
    getDatabaseMock.mockResolvedValue(createFakeDatabase() as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('creates a session and fetches it by id', async () => {
    await createSession(BASE_SESSION);

    await expect(getSession(BASE_SESSION.id)).resolves.toEqual(BASE_SESSION);
  });

  it('lists sessions for one user ordered by most recent activity', async () => {
    const olderSession: Session = {
      ...BASE_SESSION,
      id: 'session-older',
      createdAt: '2026-04-20T00:00:00.000Z',
      lastActiveAt: '2026-04-20T01:00:00.000Z',
    };
    const newerSession: Session = {
      ...BASE_SESSION,
      id: 'session-newer',
      folderPath: '/tmp/newer',
      createdAt: '2026-04-22T00:00:00.000Z',
      lastActiveAt: '2026-04-22T01:00:00.000Z',
    };
    const otherUserSession: Session = {
      ...BASE_SESSION,
      id: 'session-other-user',
      userId: 'github:user-456',
      folderPath: '/tmp/other-user',
    };

    await createSession(olderSession);
    await createSession(newerSession);
    await createSession(otherUserSession);

    await expect(listSessionsForUser(BASE_SESSION.userId)).resolves.toEqual([newerSession, olderSession]);
  });

  it('updates last_active_at without mutating other fields', async () => {
    await createSession(BASE_SESSION);

    await updateLastActive(BASE_SESSION.id, '2026-04-23T00:00:00.000Z');

    await expect(getSession(BASE_SESSION.id)).resolves.toEqual({
      ...BASE_SESSION,
      lastActiveAt: '2026-04-23T00:00:00.000Z',
    });
  });

  it('deletes a session by id', async () => {
    await createSession(BASE_SESSION);

    await deleteSession(BASE_SESSION.id);

    await expect(getSession(BASE_SESSION.id)).resolves.toBeNull();
  });
});
