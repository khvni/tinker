import type { ReasoningLevel, Session, SessionMode } from '@tinker/shared-types';
import { getDatabase } from './database.js';

export type SessionRow = {
  id: string;
  user_id: Session['userId'];
  folder_path: string;
  created_at: string;
  last_active_at: string;
  mode: SessionMode;
  model_id: string | null;
  reasoning_level: ReasoningLevel | null;
};

export type SessionUpdate = {
  folderPath?: Session['folderPath'];
  lastActiveAt?: Session['lastActiveAt'];
  mode?: Session['mode'];
  modelId?: Session['modelId'] | null;
  reasoningLevel?: Session['reasoningLevel'] | null;
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
    mode: row.mode,
    ...(row.model_id ? { modelId: row.model_id } : {}),
    ...(row.reasoning_level ? { reasoningLevel: row.reasoning_level } : {}),
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
       mode,
       model_id,
       reasoning_level
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      session.id,
      session.userId,
      session.folderPath,
      session.createdAt,
      session.lastActiveAt,
      session.mode,
      session.modelId ?? null,
      session.reasoningLevel ?? null,
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
       mode,
       model_id,
       reasoning_level
     FROM sessions
     WHERE user_id = $1
     ORDER BY last_active_at DESC, created_at DESC, id ASC`,
    [userId],
  );

  return rows.map((row) => hydrateSessionRow(row)).filter((session): session is Session => session !== null);
};

export const findLatestSessionForFolder = async (
  userId: Session['userId'],
  folderPath: Session['folderPath'],
): Promise<Session | null> => {
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
       AND folder_path = $2
     ORDER BY last_active_at DESC, created_at DESC, id ASC
     LIMIT 1`,
    [userId, folderPath],
  );

  return hydrateSessionRow(rows[0]);
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
       mode,
       model_id,
       reasoning_level
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
  await updateSession(id, { lastActiveAt });
};

export const updateSession = async (
  id: Session['id'],
  update: SessionUpdate,
): Promise<void> => {
  const assignments: string[] = [];
  const bindValues: unknown[] = [id];

  if (update.folderPath !== undefined) {
    assignments.push(`folder_path = $${bindValues.length + 1}`);
    bindValues.push(update.folderPath);
  }

  if (update.lastActiveAt !== undefined) {
    assignments.push(`last_active_at = $${bindValues.length + 1}`);
    bindValues.push(update.lastActiveAt);
  }

  if (update.mode !== undefined) {
    assignments.push(`mode = $${bindValues.length + 1}`);
    bindValues.push(update.mode);
  }

  if (update.modelId !== undefined) {
    assignments.push(`model_id = $${bindValues.length + 1}`);
    bindValues.push(update.modelId);
  }

  if (update.reasoningLevel !== undefined) {
    assignments.push(`reasoning_level = $${bindValues.length + 1}`);
    bindValues.push(update.reasoningLevel);
  }

  if (assignments.length === 0) {
    return;
  }

  const database = await getDatabase();
  await database.execute(
    `UPDATE sessions
     SET ${assignments.join(', ')}
     WHERE id = $1`,
    bindValues,
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
