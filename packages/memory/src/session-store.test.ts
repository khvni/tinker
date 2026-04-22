import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_MODE, type Session } from '@tinker/shared-types';
import { getDatabase } from './database.js';
import {
  createSession,
  deleteSession,
  findLatestSessionForFolder,
  getSession,
  hydrateSessionRow,
  listSessionsForUser,
  updateSession,
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
  mode: DEFAULT_SESSION_MODE,
  modelId: 'openai/gpt-4.1',
  reasoningLevel: 'medium',
};

const toRow = (session: Session): SessionRow => ({
  id: session.id,
  user_id: session.userId,
  folder_path: session.folderPath,
  created_at: session.createdAt,
  last_active_at: session.lastActiveAt,
  mode: session.mode,
  model_id: session.modelId ?? null,
  reasoning_level: session.reasoningLevel ?? null,
});

const createFakeDatabase = (): FakeDatabase => {
  const sessions = new Map<string, SessionRow>();
  const userIds = new Set<Session['userId']>(['google:user-123', 'github:user-456']);

  return {
    async execute(query: string, bindValues?: unknown[]): Promise<void> {
      if (query.includes('INSERT INTO sessions')) {
        const [id, userId, folderPath, createdAt, lastActiveAt, mode, modelId, reasoningLevel] = (bindValues ?? []) as [
          string,
          Session['userId'],
          string,
          string,
          string,
          Session['mode'],
          string | null,
          Exclude<Session['reasoningLevel'], undefined> | null,
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
          mode,
          model_id: modelId,
          reasoning_level: reasoningLevel,
        });
        return;
      }

      if (query.includes('UPDATE sessions')) {
        const [id, ...values] = (bindValues ?? []) as [string, ...unknown[]];
        const existing = sessions.get(id);
        if (!existing) {
          return;
        }

        const next = { ...existing };
        const [assignmentBlock] = query.split('WHERE');
        const assignments = assignmentBlock
          ?.split('SET')[1]
          ?.split(',')
          .map((assignment) => assignment.trim().split('=')[0]?.trim())
          .filter((assignment): assignment is keyof SessionRow => assignment !== undefined) ?? [];

        assignments.forEach((assignment, index) => {
          const value = values[index] ?? null;
          if (assignment === 'folder_path' && typeof value === 'string') {
            next.folder_path = value;
          } else if (assignment === 'last_active_at' && typeof value === 'string') {
            next.last_active_at = value;
          } else if (assignment === 'mode' && typeof value === 'string') {
            next.mode = value as Session['mode'];
          } else if (assignment === 'model_id') {
            next.model_id = value as string | null;
          } else if (assignment === 'reasoning_level') {
            next.reasoning_level = value as Exclude<Session['reasoningLevel'], undefined> | null;
          }
        });

        sessions.set(id, next);
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

      if (query.includes('WHERE user_id = $1') && query.includes('folder_path = $2')) {
        const [userId, folderPath] = (bindValues ?? []) as [Session['userId'], Session['folderPath']];
        const rows = Array.from(sessions.values())
          .filter((session) => session.user_id === userId && session.folder_path === folderPath)
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

        return rows.slice(0, 1) as TRow;
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
        reasoning_level: null,
      }),
    ).toEqual({
      id: BASE_SESSION.id,
      userId: BASE_SESSION.userId,
      folderPath: BASE_SESSION.folderPath,
      createdAt: BASE_SESSION.createdAt,
      lastActiveAt: BASE_SESSION.lastActiveAt,
      mode: BASE_SESSION.mode,
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

  it('updates persisted model, mode, and reasoning fields together', async () => {
    await createSession(BASE_SESSION);

    await updateSession(BASE_SESSION.id, {
      mode: 'plan',
      modelId: 'anthropic/claude-sonnet-4',
      reasoningLevel: 'high',
    });

    await expect(getSession(BASE_SESSION.id)).resolves.toEqual({
      ...BASE_SESSION,
      mode: 'plan',
      modelId: 'anthropic/claude-sonnet-4',
      reasoningLevel: 'high',
    });
  });

  it('can clear nullable session preferences without touching mode', async () => {
    await createSession(BASE_SESSION);

    await updateSession(BASE_SESSION.id, {
      modelId: null,
      reasoningLevel: null,
    });

    await expect(getSession(BASE_SESSION.id)).resolves.toEqual({
      id: BASE_SESSION.id,
      userId: BASE_SESSION.userId,
      folderPath: BASE_SESSION.folderPath,
      createdAt: BASE_SESSION.createdAt,
      lastActiveAt: BASE_SESSION.lastActiveAt,
      mode: DEFAULT_SESSION_MODE,
    });
  });

  it('finds the most recent session for one user + folder pair', async () => {
    const olderSession: Session = {
      ...BASE_SESSION,
      id: 'session-older',
      lastActiveAt: '2026-04-20T01:00:00.000Z',
    };
    const newerSameFolder: Session = {
      ...BASE_SESSION,
      id: 'session-newer',
      lastActiveAt: '2026-04-22T01:00:00.000Z',
    };
    const newerOtherFolder: Session = {
      ...BASE_SESSION,
      id: 'session-other-folder',
      folderPath: '/tmp/beta',
      lastActiveAt: '2026-04-23T01:00:00.000Z',
    };

    await createSession(olderSession);
    await createSession(newerSameFolder);
    await createSession(newerOtherFolder);

    await expect(findLatestSessionForFolder(BASE_SESSION.userId, BASE_SESSION.folderPath)).resolves.toEqual(
      newerSameFolder,
    );
  });

  it('deletes a session by id', async () => {
    await createSession(BASE_SESSION);

    await deleteSession(BASE_SESSION.id);

    await expect(getSession(BASE_SESSION.id)).resolves.toBeNull();
  });
});
