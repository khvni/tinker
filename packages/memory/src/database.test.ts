import { describe, expect, it } from 'vitest';
import { DATABASE_SCHEMA } from './database.js';

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
});
