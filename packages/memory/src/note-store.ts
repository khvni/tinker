/**
 * Note storage backed by SQLite (TIN-238).
 *
 * Notes are raw human context sources stored locally, completely separate from
 * memory. Each note can be individually opted in/out of agent context.
 */

import type { ContextSource, Note, NoteListEntry, NoteStore } from '@tinker/shared-types';
import { getDatabase } from './database.js';

type NoteRow = {
  id: string;
  title: string;
  body: string;
  context_enabled: number;
  created_at: string;
  updated_at: string;
};

const EXCERPT_LENGTH = 200;

const toExcerpt = (body: string): string => {
  const trimmed = body.replace(/\s+/gu, ' ').trim();
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed;
  return trimmed.slice(0, EXCERPT_LENGTH) + '…';
};

const rowToNote = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  contextEnabled: row.context_enabled === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToListEntry = (row: NoteRow): NoteListEntry => ({
  id: row.id,
  title: row.title,
  contextEnabled: row.context_enabled === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  excerpt: toExcerpt(row.body),
});

export const createNoteStore = (sqlUrl?: string): NoteStore => {
  const db = () => getDatabase(sqlUrl);

  const create = async (title: string, body: string): Promise<Note> => {
    const database = await db();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await database.execute(
      'INSERT INTO notes (id, title, body, context_enabled, created_at, updated_at) VALUES ($1, $2, $3, 1, $4, $5)',
      [id, title, body, now, now],
    );
    await database.execute(
      'INSERT INTO notes_fts (id, title, body) VALUES ($1, $2, $3)',
      [id, title, body],
    );

    return { id, title, body, contextEnabled: true, createdAt: now, updatedAt: now };
  };

  const get = async (id: string): Promise<Note | null> => {
    const database = await db();
    const rows = await database.select<NoteRow[]>(
      'SELECT id, title, body, context_enabled, created_at, updated_at FROM notes WHERE id = $1',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return rowToNote(row);
  };

  const list = async (): Promise<NoteListEntry[]> => {
    const database = await db();
    const rows = await database.select<NoteRow[]>(
      'SELECT id, title, body, context_enabled, created_at, updated_at FROM notes ORDER BY updated_at DESC',
    );
    return rows.map(rowToListEntry);
  };

  const search = async (query: string): Promise<NoteListEntry[]> => {
    const database = await db();
    const sanitized = query.replace(/["*]/gu, '').trim();
    if (sanitized.length === 0) return list();

    const ftsQuery = sanitized
      .split(/\s+/u)
      .map((term) => `"${term}"*`)
      .join(' ');

    const rows = await database.select<NoteRow[]>(
      `SELECT n.id, n.title, n.body, n.context_enabled, n.created_at, n.updated_at
       FROM notes n
       JOIN notes_fts fts ON fts.id = n.id
       WHERE notes_fts MATCH $1
       ORDER BY n.updated_at DESC`,
      [ftsQuery],
    );
    return rows.map(rowToListEntry);
  };

  const update = async (
    id: string,
    fields: { title?: string; body?: string; contextEnabled?: boolean },
  ): Promise<Note | null> => {
    const database = await db();
    const existing = await get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextTitle = fields.title ?? existing.title;
    const nextBody = fields.body ?? existing.body;
    const nextContextEnabled = fields.contextEnabled ?? existing.contextEnabled;

    await database.execute(
      'UPDATE notes SET title = $1, body = $2, context_enabled = $3, updated_at = $4 WHERE id = $5',
      [nextTitle, nextBody, nextContextEnabled ? 1 : 0, now, id],
    );
    await database.execute('DELETE FROM notes_fts WHERE id = $1', [id]);
    await database.execute(
      'INSERT INTO notes_fts (id, title, body) VALUES ($1, $2, $3)',
      [id, nextTitle, nextBody],
    );

    return { id, title: nextTitle, body: nextBody, contextEnabled: nextContextEnabled, createdAt: existing.createdAt, updatedAt: now };
  };

  const remove = async (id: string): Promise<boolean> => {
    const database = await db();
    const result = await database.execute('DELETE FROM notes WHERE id = $1', [id]);
    if (result.rowsAffected === 0) return false;
    await database.execute('DELETE FROM notes_fts WHERE id = $1', [id]);
    return true;
  };

  return { create, get, list, search, update, remove };
};

/**
 * Returns all context-enabled notes as ContextSource records for Goose.
 */
export const listNoteContextSources = async (sqlUrl?: string): Promise<ContextSource[]> => {
  const database = await getDatabase(sqlUrl);
  const rows = await database.select<NoteRow[]>(
    'SELECT id, title, body, context_enabled, created_at, updated_at FROM notes WHERE context_enabled = 1 ORDER BY updated_at DESC',
  );

  return rows.map((row): ContextSource => ({
    id: `note:${row.id}`,
    kind: 'note',
    title: row.title,
    excerpt: toExcerpt(row.body),
    body: row.body,
    provenance: {
      sourceId: row.id,
      sourceKind: 'note',
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  }));
};
