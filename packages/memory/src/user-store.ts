import type { User } from '@tinker/shared-types';
import { getDatabase } from './database.js';

export type UserRow = {
  id: string;
  provider: User['provider'];
  provider_user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  last_seen_at: string;
};

export const hydrateUserRow = (row: UserRow | undefined): User | null => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    ...(row.email ? { email: row.email } : {}),
  };
};

export const upsertUser = async (user: User): Promise<void> => {
  const database = await getDatabase();

  await database.execute(
    `INSERT INTO users (
       id,
       provider,
       provider_user_id,
       display_name,
       avatar_url,
       email,
       created_at,
       last_seen_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       email = excluded.email,
       last_seen_at = excluded.last_seen_at`,
    [
      user.id,
      user.provider,
      user.providerUserId,
      user.displayName,
      user.avatarUrl ?? null,
      user.email ?? null,
      user.createdAt,
      user.lastSeenAt,
    ],
  );
};

export const getUser = async (id: User['id']): Promise<User | null> => {
  const database = await getDatabase();
  const rows = await database.select<UserRow[]>(
    `SELECT
       id,
       provider,
       provider_user_id,
       display_name,
       avatar_url,
       email,
       created_at,
       last_seen_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return hydrateUserRow(rows[0]);
};

export const listUsersByLastSeen = async (): Promise<User[]> => {
  const database = await getDatabase();
  const rows = await database.select<UserRow[]>(
    `SELECT
       id,
       provider,
       provider_user_id,
       display_name,
       avatar_url,
       email,
       created_at,
       last_seen_at
     FROM users
     ORDER BY last_seen_at DESC, created_at DESC, id ASC`,
  );

  return rows.map((row) => hydrateUserRow(row)).filter((user): user is User => user !== null);
};

export const getUserByProvider = async (
  provider: User['provider'],
  providerUserId: User['providerUserId'],
): Promise<User | null> => {
  const database = await getDatabase();
  const rows = await database.select<UserRow[]>(
    `SELECT
       id,
       provider,
       provider_user_id,
       display_name,
       avatar_url,
       email,
       created_at,
       last_seen_at
     FROM users
     WHERE provider = $1
       AND provider_user_id = $2
     LIMIT 1`,
    [provider, providerUserId],
  );

  return hydrateUserRow(rows[0]);
};

export const updateLastSeen = async (id: User['id'], lastSeenAt: User['lastSeenAt']): Promise<void> => {
  const database = await getDatabase();
  await database.execute(
    `UPDATE users
     SET last_seen_at = $2
     WHERE id = $1`,
    [id, lastSeenAt],
  );
};
