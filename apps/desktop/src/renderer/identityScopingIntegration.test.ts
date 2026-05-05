import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix as pathPosix, sep as PATH_SEP } from 'node:path';
import { promises as fsp } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '@opencode-ai/sdk/v2/client';

const hoisted = vi.hoisted(() => {
  let testRoot: string | null = null;

  const setRoot = (root: string): void => {
    testRoot = root;
  };

  const dataPath = (): string => {
    if (!testRoot) {
      throw new Error('Test root not initialized.');
    }
    return pathPosix.join(testRoot, 'data');
  };

  type AppSettingRow = { key: string; value_json: string; updated_at: string };
  type UserRow = {
    id: string;
    provider: string;
    provider_user_id: string;
    display_name: string;
    avatar_url: string | null;
    email: string | null;
    created_at: string;
    last_seen_at: string;
  };
  type SessionRow = {
    id: string;
    user_id: string;
    folder_path: string;
    created_at: string;
    last_active_at: string;
    mode: string;
    model_id: string | null;
    reasoning_level: string | null;
  };

  const settings = new Map<string, AppSettingRow>();
  const users = new Map<string, UserRow>();
  const sessions = new Map<string, SessionRow>();

  const reset = (): void => {
    settings.clear();
    users.clear();
    sessions.clear();
  };

  const normalizeQuery = (sql: string): string => {
    return sql.replace(/\s+/gu, ' ').trim();
  };

  const fakeExecute = async (sql: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }> => {
    const query = normalizeQuery(sql);
    const args = bindValues ?? [];

    if (
      query.startsWith('CREATE TABLE') ||
      query.startsWith('CREATE INDEX') ||
      query.startsWith('CREATE UNIQUE INDEX') ||
      query.startsWith('CREATE VIRTUAL TABLE') ||
      query.startsWith('ALTER TABLE') ||
      query.startsWith('DROP TABLE')
    ) {
      return { rowsAffected: 0, lastInsertId: 0 };
    }

    if (query.startsWith('INSERT INTO app_settings')) {
      const [key, valueJson, updatedAt] = args as [string, string, string];
      settings.set(key, { key, value_json: valueJson, updated_at: updatedAt });
      return { rowsAffected: 1, lastInsertId: 0 };
    }

    if (query.startsWith('DELETE FROM app_settings')) {
      const [key] = args as [string];
      settings.delete(key);
      return { rowsAffected: 1, lastInsertId: 0 };
    }

    if (query.startsWith('INSERT INTO users')) {
      const [id, provider, providerUserId, displayName, avatarUrl, email, createdAt, lastSeenAt] = args as [
        string,
        string,
        string,
        string,
        string | null,
        string | null,
        string,
        string,
      ];
      const compositeMatch = [...users.values()].find(
        (row) => row.provider === provider && row.provider_user_id === providerUserId,
      );
      if (compositeMatch) {
        users.set(compositeMatch.id, {
          ...compositeMatch,
          display_name: displayName,
          avatar_url: avatarUrl,
          email,
          last_seen_at: lastSeenAt,
        });
      } else {
        users.set(id, {
          id,
          provider,
          provider_user_id: providerUserId,
          display_name: displayName,
          avatar_url: avatarUrl,
          email,
          created_at: createdAt,
          last_seen_at: lastSeenAt,
        });
      }
      return { rowsAffected: 1, lastInsertId: 0 };
    }

    if (query.startsWith('INSERT INTO sessions')) {
      const [id, userId, folderPath, createdAt, lastActiveAt, mode, modelId, reasoningLevel] = args as [
        string,
        string,
        string,
        string,
        string,
        string,
        string | null,
        string | null,
      ];
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
      return { rowsAffected: 1, lastInsertId: 0 };
    }

    throw new Error(`Unhandled fake-database execute: ${query}`);
  };

  const fakeSelect = async <TRow,>(sql: string, bindValues?: unknown[]): Promise<TRow> => {
    const query = normalizeQuery(sql);
    const args = bindValues ?? [];

    if (query.startsWith('PRAGMA table_info(sessions)')) {
      return [
        { name: 'id' },
        { name: 'user_id' },
        { name: 'folder_path' },
        { name: 'created_at' },
        { name: 'last_active_at' },
        { name: 'mode' },
        { name: 'model_id' },
        { name: 'reasoning_level' },
      ] as TRow;
    }

    if (query.startsWith('PRAGMA table_info(relationships)')) {
      return [
        { name: 'subject_id' },
        { name: 'predicate' },
        { name: 'object_id' },
        { name: 'confidence' },
        { name: 'source' },
        { name: 'sources_json' },
      ] as TRow;
    }

    if (query.startsWith('PRAGMA table_info(layouts)')) {
      return [{ name: 'user_id' }, { name: 'version' }, { name: 'workspace_state_json' }, { name: 'updated_at' }] as TRow;
    }

    if (query.startsWith('SELECT key, value_json, updated_at FROM app_settings WHERE key =')) {
      const [key] = args as [string];
      const row = settings.get(key);
      return (row ? [row] : []) as TRow;
    }

    if (query.startsWith('SELECT key, value_json, updated_at FROM app_settings ORDER BY key')) {
      return [...settings.values()].sort((a, b) => a.key.localeCompare(b.key)) as TRow;
    }

    if (
      query.startsWith('SELECT id, user_id, folder_path, created_at, last_active_at, mode, model_id, reasoning_level FROM sessions WHERE user_id =') &&
      query.includes('AND folder_path =')
    ) {
      const [userId, folderPath] = args as [string, string];
      const rows = [...sessions.values()]
        .filter((row) => row.user_id === userId && row.folder_path === folderPath)
        .sort((left, right) => {
          return (
            right.last_active_at.localeCompare(left.last_active_at) ||
            right.created_at.localeCompare(left.created_at) ||
            left.id.localeCompare(right.id)
          );
        });
      return rows.slice(0, 1) as TRow;
    }

    if (
      query.startsWith('SELECT id, user_id, folder_path, created_at, last_active_at, model_id FROM sessions WHERE user_id =') &&
      query.includes('AND folder_path =')
    ) {
      const [userId, folderPath] = args as [string, string];
      const rows = [...sessions.values()]
        .filter((row) => row.user_id === userId && row.folder_path === folderPath)
        .sort((left, right) => {
          return (
            right.last_active_at.localeCompare(left.last_active_at) ||
            right.created_at.localeCompare(left.created_at) ||
            left.id.localeCompare(right.id)
          );
        });
      return rows.slice(0, 1) as TRow;
    }

    if (query.startsWith('SELECT id, user_id, folder_path, created_at, last_active_at, mode, model_id, reasoning_level FROM sessions WHERE user_id =')) {
      const [userId] = args as [string];
      const rows = [...sessions.values()]
        .filter((row) => row.user_id === userId)
        .sort((left, right) => {
          return (
            right.last_active_at.localeCompare(left.last_active_at) ||
            right.created_at.localeCompare(left.created_at) ||
            left.id.localeCompare(right.id)
          );
        });
      return rows as TRow;
    }

    if (query.startsWith('SELECT id, user_id, folder_path, created_at, last_active_at, mode, model_id, reasoning_level FROM sessions WHERE id =')) {
      const [id] = args as [string];
      const row = sessions.get(id);
      return (row ? [row] : []) as TRow;
    }

    if (query.startsWith('SELECT id, provider, provider_user_id, display_name, avatar_url, email, created_at, last_seen_at FROM users')) {
      if (query.includes('WHERE id =')) {
        const [id] = args as [string];
        const row = users.get(id);
        return (row ? [row] : []) as TRow;
      }
      if (query.includes('WHERE provider =')) {
        const [provider, providerUserId] = args as [string, string];
        const row = [...users.values()].find(
          (entry) => entry.provider === provider && entry.provider_user_id === providerUserId,
        );
        return (row ? [row] : []) as TRow;
      }
      return [...users.values()].sort((a, b) => {
        return (
          b.last_seen_at.localeCompare(a.last_seen_at) ||
          b.created_at.localeCompare(a.created_at) ||
          a.id.localeCompare(b.id)
        );
      }) as TRow;
    }

    throw new Error(`Unhandled fake-database select: ${query}`);
  };

  const fakeDatabase = {
    execute: fakeExecute,
    select: fakeSelect,
    close: vi.fn(async () => {}),
  };

  const ensureAbsolute = (input: string): string => {
    if (!testRoot) {
      throw new Error('Test root not initialized.');
    }

    const normalized = input.replace(/\\/gu, '/');
    const rebasedRoot = testRoot.replace(/\\/gu, '/');
    if (normalized === rebasedRoot || normalized.startsWith(`${rebasedRoot}/`)) {
      return normalized;
    }
    if (normalized.startsWith('/')) {
      return pathPosix.join(rebasedRoot, normalized.slice(1));
    }
    return pathPosix.join(rebasedRoot, normalized);
  };

  return { setRoot, dataPath, reset, fakeDatabase, ensureAbsolute };
});

vi.mock('@tauri-apps/api/path', () => ({
  dataDir: async (): Promise<string> => hoisted.dataPath(),
  join: async (...segments: string[]): Promise<string> => pathPosix.join(...segments),
}));

vi.mock('@tauri-apps/plugin-fs', () => {
  type DirEntry = { name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean };
  type WriteOptions = { append?: boolean; create?: boolean };
  type RemoveOptions = { recursive?: boolean };
  type StatResult = { mtime: Date | null };

  const exists = async (path: string): Promise<boolean> => {
    try {
      await fsp.access(hoisted.ensureAbsolute(path));
      return true;
    } catch {
      return false;
    }
  };

  const mkdir = async (path: string, options?: { recursive?: boolean }): Promise<void> => {
    await fsp.mkdir(hoisted.ensureAbsolute(path), { recursive: options?.recursive ?? false });
  };

  const writeTextFile = async (path: string, contents: string, options?: WriteOptions): Promise<void> => {
    const absolute = hoisted.ensureAbsolute(path);
    if (options?.append) {
      await fsp.appendFile(absolute, contents, 'utf8');
      return;
    }
    await fsp.writeFile(absolute, contents, 'utf8');
  };

  const readTextFile = async (path: string): Promise<string> => {
    return fsp.readFile(hoisted.ensureAbsolute(path), 'utf8');
  };

  const readDir = async (path: string): Promise<DirEntry[]> => {
    const entries = await fsp.readdir(hoisted.ensureAbsolute(path), { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      isSymlink: entry.isSymbolicLink(),
    }));
  };

  const stat = async (path: string): Promise<StatResult> => {
    const info = await fsp.stat(hoisted.ensureAbsolute(path));
    return { mtime: info.mtime };
  };

  const copyFile = async (source: string, destination: string): Promise<void> => {
    await fsp.copyFile(hoisted.ensureAbsolute(source), hoisted.ensureAbsolute(destination));
  };

  const remove = async (path: string, options?: RemoveOptions): Promise<void> => {
    await fsp.rm(hoisted.ensureAbsolute(path), { recursive: options?.recursive ?? false, force: true });
  };

  return { exists, mkdir, writeTextFile, readTextFile, readDir, stat, copyFile, remove };
});

vi.mock('@tauri-apps/plugin-sql', () => {
  return {
    default: {
      load: async (): Promise<unknown> => hoisted.fakeDatabase,
    },
  };
});

import {
  buildChatHistoryDirectory,
  buildChatHistoryPath,
  createChatHistoryWriter,
  readChatHistory,
  type StoredChatEvent,
} from '@tinker/bridge';
import {
  createSession,
  findLatestSessionForFolder,
  getUser,
  listSessionsForUser,
  subscribeMemoryPathChanged,
  syncActiveMemoryPath,
  upsertUser,
  type MemoryPathChangedDetail,
} from '@tinker/memory';
import { DEFAULT_SESSION_MODE, type Session, type User } from '@tinker/shared-types';

const FOLDER_PATH = '/vault/folder-f';

const USER_A: User = {
  id: 'google:user-alpha',
  provider: 'google',
  providerUserId: 'user-alpha',
  displayName: 'Alpha User',
  email: 'alpha@example.com',
  createdAt: '2026-04-25T10:00:00.000Z',
  lastSeenAt: '2026-04-25T10:00:00.000Z',
};

const USER_B: User = {
  id: 'github:user-beta',
  provider: 'github',
  providerUserId: 'user-beta',
  displayName: 'Beta User',
  email: 'beta@example.com',
  createdAt: '2026-04-25T11:00:00.000Z',
  lastSeenAt: '2026-04-25T11:00:00.000Z',
};

const buildSession = (user: User, id: string, lastActiveAt: string): Session => ({
  id,
  userId: user.id,
  folderPath: FOLDER_PATH,
  createdAt: lastActiveAt,
  lastActiveAt,
  mode: DEFAULT_SESSION_MODE,
});

const makeEvent = (type: string, properties: Record<string, unknown>): Event => {
  return { type, properties } as unknown as Event;
};

let tempRoot: string | null = null;

const stubProcessPlatform = (platform: NodeJS.Platform): void => {
  vi.stubGlobal('process', { ...process, platform });
};

beforeEach(async () => {
  hoisted.reset();
  tempRoot = mkdtempSync(`${tmpdir()}${PATH_SEP}tinker-tin88-`).replace(/\\/gu, '/');
  hoisted.setRoot(tempRoot);
  await fsp.mkdir(hoisted.dataPath(), { recursive: true });
  await fsp.mkdir(hoisted.ensureAbsolute(FOLDER_PATH), { recursive: true });
  stubProcessPlatform('linux');
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  tempRoot = null;
});

describe('TIN-88 — end-to-end identity scoping', () => {
  it('keeps sessions, chat history, and memory subdirs scoped per user across sign-out / sign-in cycles', async () => {
    const memoryEvents: MemoryPathChangedDetail[] = [];
    const unsubscribe = subscribeMemoryPathChanged((detail) => memoryEvents.push(detail));

    try {
      // ── Step 1: User A signs in, picks folder F, sends a message, "closes" the app.
      await upsertUser(USER_A);
      const userAMemoryPath = await syncActiveMemoryPath(USER_A.id);
      expect(userAMemoryPath.endsWith(`/${USER_A.id}`)).toBe(true);

      const sessionA = buildSession(USER_A, 'session-alpha-1', '2026-04-25T10:05:00.000Z');
      await createSession(sessionA);

      const writerA = createChatHistoryWriter({
        folderPath: FOLDER_PATH,
        userId: USER_A.id,
        sessionId: sessionA.id,
        now: () => '2026-04-25T10:05:00.000Z',
      });
      writerA.appendEvent(makeEvent('message.created', { sessionID: sessionA.id, role: 'user' }));
      writerA.appendEvent(
        makeEvent('message.part.delta', { sessionID: sessionA.id, partID: 'part-1', delta: 'hello from alpha' }),
      );
      await writerA.dispose();

      const userAJsonlPath = buildChatHistoryPath({
        folderPath: FOLDER_PATH,
        userId: USER_A.id,
        sessionId: sessionA.id,
      });
      expect(userAJsonlPath).toBe(`${FOLDER_PATH}/.tinker/chats/${USER_A.id}/${sessionA.id}.jsonl`);
      const userAJsonl = await fsp.readFile(hoisted.ensureAbsolute(userAJsonlPath), 'utf8');
      expect(userAJsonl.trim().split('\n')).toHaveLength(2);

      // Drop a memory marker so we can prove User B never sees it.
      const userAMarker = pathPosix.join(userAMemoryPath, 'private-note.md');
      await fsp.writeFile(hoisted.ensureAbsolute(userAMarker), '# Alpha private note', 'utf8');

      // ── Step 2: Sign out, then sign in as User B.
      await upsertUser(USER_B);
      const userBMemoryPath = await syncActiveMemoryPath(USER_B.id);
      expect(userBMemoryPath).not.toBe(userAMemoryPath);
      expect(userBMemoryPath.endsWith(`/${USER_B.id}`)).toBe(true);

      const switchEvent = memoryEvents.at(-1);
      expect(switchEvent?.previousUserId).toBe(USER_A.id);
      expect(switchEvent?.nextUserId).toBe(USER_B.id);
      expect(switchEvent?.previousPath).toBe(userAMemoryPath);
      expect(switchEvent?.nextPath).toBe(userBMemoryPath);

      // ── Step 3: Folder F session NOT visible in User B's switcher.
      await expect(listSessionsForUser(USER_B.id)).resolves.toEqual([]);
      await expect(findLatestSessionForFolder(USER_B.id, FOLDER_PATH)).resolves.toBeNull();
      await expect(listSessionsForUser(USER_A.id)).resolves.toEqual([sessionA]);

      // ── Step 4: User B picks folder F → new JSONL file at the per-user path.
      const sessionB = buildSession(USER_B, 'session-beta-1', '2026-04-25T11:10:00.000Z');
      await createSession(sessionB);

      const writerB = createChatHistoryWriter({
        folderPath: FOLDER_PATH,
        userId: USER_B.id,
        sessionId: sessionB.id,
        now: () => '2026-04-25T11:10:00.000Z',
      });
      writerB.appendEvent(makeEvent('message.created', { sessionID: sessionB.id, role: 'user' }));
      await writerB.dispose();

      const userBJsonlPath = buildChatHistoryPath({
        folderPath: FOLDER_PATH,
        userId: USER_B.id,
        sessionId: sessionB.id,
      });
      expect(userBJsonlPath).toBe(`${FOLDER_PATH}/.tinker/chats/${USER_B.id}/${sessionB.id}.jsonl`);
      expect(userBJsonlPath).not.toBe(userAJsonlPath);
      await expect(fsp.access(hoisted.ensureAbsolute(userBJsonlPath))).resolves.toBeUndefined();

      const userBChatsDir = buildChatHistoryDirectory({ folderPath: FOLDER_PATH, userId: USER_B.id });
      const userBChatsContents = await fsp.readdir(hoisted.ensureAbsolute(userBChatsDir));
      expect(userBChatsContents).toEqual([`${sessionB.id}.jsonl`]);

      // User A's JSONL is untouched.
      const userAJsonlAfter = await fsp.readFile(hoisted.ensureAbsolute(userAJsonlPath), 'utf8');
      expect(userAJsonlAfter).toBe(userAJsonl);

      // ── Step 5: User B's memory subdir is empty (no User A data leaks in).
      const userBContents = await fsp.readdir(hoisted.ensureAbsolute(userBMemoryPath));
      expect(userBContents).not.toContain('private-note.md');

      // User A's marker is still where we left it; reusing the same memory root for B did not overwrite it.
      const userAContents = await fsp.readdir(hoisted.ensureAbsolute(userAMemoryPath));
      expect(userAContents).toContain('private-note.md');

      // ── Step 6: Sign out → sign back in as User A → old session resumes + hydrates.
      const userAMemoryPathAgain = await syncActiveMemoryPath(USER_A.id);
      expect(userAMemoryPathAgain).toBe(userAMemoryPath);

      const restoreEvent = memoryEvents.at(-1);
      expect(restoreEvent?.previousUserId).toBe(USER_B.id);
      expect(restoreEvent?.nextUserId).toBe(USER_A.id);
      expect(restoreEvent?.nextPath).toBe(userAMemoryPath);

      await expect(listSessionsForUser(USER_A.id)).resolves.toEqual([sessionA]);
      await expect(findLatestSessionForFolder(USER_A.id, FOLDER_PATH)).resolves.toEqual(sessionA);

      const replayed: StoredChatEvent[] = await readChatHistory({
        folderPath: FOLDER_PATH,
        userId: USER_A.id,
        sessionId: sessionA.id,
      });
      expect(replayed.map((entry) => entry.event)).toEqual(['message.created', 'message.part.delta']);
      expect((replayed[1]?.data as { delta?: string } | null)?.delta).toBe('hello from alpha');

      // Cross-user isolation still holds in the other direction.
      await expect(listSessionsForUser(USER_B.id)).resolves.toEqual([sessionB]);
      await expect(findLatestSessionForFolder(USER_B.id, FOLDER_PATH)).resolves.toEqual(sessionB);

      const userARestored = await getUser(USER_A.id);
      expect(userARestored?.email).toBe(USER_A.email);
    } finally {
      unsubscribe();
    }
  });
});
