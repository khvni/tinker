import type { Session } from '@tinker/shared-types';
import { getDatabase } from './database.js';

export type SessionRow = {
  id: string;
  user_id: Session['userId'];
  folder_path: string;
  created_at: string;
  last_active_at: string;
  model_id: string | null;
};

export const hydrateSessionRow = (row: SessionRow | undefined): Session | null => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    folderPath: row.folder_path,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    ...(row.model_id ? { modelId: row.model_id } : {}),
  };
};

export const createSession = async (session: Session): Promise<void> => {
  const database = await getDatabase();

  await database.execute(
    `INSERT INTO sessions (
       id,
       user_id,
       folder_path,
       created_at,
       last_active_at,
       model_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      session.id,
      session.userId,
      session.folderPath,
      session.createdAt,
      session.lastActiveAt,
      session.modelId ?? null,
    ],
  );
};

export const listSessionsForUser = async (userId: Session['userId']): Promise<Session[]> => {
  const database = await getDatabase();
  const rows = await database.select<SessionRow[]>(
    `SELECT
       id,
       user_id,
       folder_path,
       created_at,
       last_active_at,
       model_id
     FROM sessions
     WHERE user_id = $1
     ORDER BY last_active_at DESC, created_at DESC, id ASC`,
    [userId],
  );

  return rows.map((row) => hydrateSessionRow(row)).filter((session): session is Session => session !== null);
};

export const getSession = async (id: Session['id']): Promise<Session | null> => {
  const database = await getDatabase();
  const rows = await database.select<SessionRow[]>(
    `SELECT
       id,
       user_id,
       folder_path,
       created_at,
       last_active_at,
       model_id
     FROM sessions
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return hydrateSessionRow(rows[0]);
};

export const updateLastActive = async (
  id: Session['id'],
  lastActiveAt: Session['lastActiveAt'],
): Promise<void> => {
  const database = await getDatabase();
  await database.execute(
    `UPDATE sessions
     SET last_active_at = $2
     WHERE id = $1`,
    [id, lastActiveAt],
  );
};

export const deleteSession = async (id: Session['id']): Promise<void> => {
  const database = await getDatabase();
  await database.execute(
    `DELETE FROM sessions
     WHERE id = $1`,
    [id],
  );
};
