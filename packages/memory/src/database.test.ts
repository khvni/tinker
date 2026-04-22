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
});
