import type Database from '@tauri-apps/plugin-sql';
import type { QueryResult } from '@tauri-apps/plugin-sql';
import { describe, expect, it, vi } from 'vitest';
import {
  DATABASE_SCHEMA,
  ensureEntityTableColumns,
  ensureJobTableColumns,
  ensureRelationshipTableColumns,
  ensureSessionTableColumns,
} from './database.js';

describe('DATABASE_SCHEMA', () => {
  it('creates the users table with the shared-user columns', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE TABLE IF NOT EXISTS users') &&
          statement.includes('provider_user_id TEXT NOT NULL') &&
          statement.includes('last_seen_at TEXT NOT NULL'),
      ),
    ).toBe(true);
  });

  it('creates the composite provider/provider_user_id unique index', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE UNIQUE INDEX IF NOT EXISTS users_provider_provider_user_id_idx') &&
          statement.includes('ON users (provider, provider_user_id)'),
      ),
    ).toBe(true);
  });

  it('creates the sessions table with shared-session columns and user foreign key', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE TABLE IF NOT EXISTS sessions') &&
          statement.includes('user_id TEXT NOT NULL') &&
          statement.includes('folder_path TEXT NOT NULL') &&
          statement.includes('last_active_at TEXT NOT NULL') &&
          statement.includes("mode TEXT NOT NULL DEFAULT 'build'") &&
          statement.includes('reasoning_level TEXT') &&
          statement.includes('FOREIGN KEY (user_id) REFERENCES users(id)'),
      ),
    ).toBe(true);
  });

  it('creates the sessions user/activity index for switcher queries', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE INDEX IF NOT EXISTS sessions_user_id_last_active_at_idx') &&
          statement.includes('ON sessions (user_id, last_active_at)'),
      ),
    ).toBe(true);
  });

  it('adds missing session preference columns on older databases', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([
      { name: 'id' },
      { name: 'user_id' },
      { name: 'folder_path' },
    ]);

    await ensureSessionTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).toHaveBeenCalledWith(
      "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'build'",
    );
    expect(execute).toHaveBeenCalledWith('ALTER TABLE sessions ADD COLUMN reasoning_level TEXT');
  });

  it('skips session preference migrations when columns already exist', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([
      { name: 'id' },
      { name: 'user_id' },
      { name: 'folder_path' },
      { name: 'mode' },
      { name: 'reasoning_level' },
    ]);

    await ensureSessionTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).not.toHaveBeenCalled();
  });

  it('creates relationships table with provenance json column', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE TABLE IF NOT EXISTS relationships') &&
          statement.includes("sources_json TEXT NOT NULL DEFAULT '[]'"),
      ),
    ).toBe(true);
  });

  it('adds missing relationship provenance column on older databases', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([
      { name: 'subject_id' },
      { name: 'predicate' },
      { name: 'object_id' },
      { name: 'confidence' },
      { name: 'source' },
    ]);

    await ensureRelationshipTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).toHaveBeenCalledWith("ALTER TABLE relationships ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'");
  });

  it('declares stale_since on the entities table for non-destructive cleanup flagging', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE TABLE IF NOT EXISTS entities') &&
          statement.includes('stale_since TEXT'),
      ),
    ).toBe(true);
  });

  it('declares task_kind on the jobs table with a prompt default for the discriminator', () => {
    expect(
      DATABASE_SCHEMA.some(
        (statement) =>
          statement.includes('CREATE TABLE IF NOT EXISTS jobs') &&
          statement.includes("task_kind TEXT NOT NULL DEFAULT 'prompt'"),
      ),
    ).toBe(true);
  });

  it('adds stale_since to legacy entities tables', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([{ name: 'id' }, { name: 'kind' }, { name: 'name' }]);

    await ensureEntityTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).toHaveBeenCalledWith('ALTER TABLE entities ADD COLUMN stale_since TEXT');
  });

  it('skips stale_since migration when the column already exists', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([{ name: 'id' }, { name: 'stale_since' }]);

    await ensureEntityTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).not.toHaveBeenCalled();
  });

  it('adds task_kind to legacy jobs tables', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([{ name: 'id' }, { name: 'name' }, { name: 'prompt' }]);

    await ensureJobTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).toHaveBeenCalledWith(
      "ALTER TABLE jobs ADD COLUMN task_kind TEXT NOT NULL DEFAULT 'prompt'",
    );
  });

  it('skips task_kind migration when the column already exists', async () => {
    const execute = vi.fn<Database['execute']>().mockResolvedValue({
      rowsAffected: 0,
    } satisfies QueryResult);
    const select = vi.fn().mockResolvedValue([{ name: 'id' }, { name: 'task_kind' }]);

    await ensureJobTableColumns({
      execute,
      select,
    } as unknown as Pick<Database, 'execute' | 'select'>);

    expect(execute).not.toHaveBeenCalled();
  });
});
