/**
 * Types for the Notes context-source system (TIN-238).
 *
 * Notes are raw human context sources stored locally, completely separate from
 * the memory wiki. Each note can be individually opted in/out of agent context.
 */

export type Note = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly contextEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NoteListEntry = {
  readonly id: string;
  readonly title: string;
  readonly contextEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly excerpt: string;
};

export type NoteStore = {
  create(title: string, body: string): Promise<Note>;
  get(id: string): Promise<Note | null>;
  list(): Promise<NoteListEntry[]>;
  search(query: string): Promise<NoteListEntry[]>;
  update(id: string, fields: { title?: string; body?: string; contextEnabled?: boolean }): Promise<Note | null>;
  remove(id: string): Promise<boolean>;
};

/**
 * A context source record exposed to Goose for retrieval/memory workflows.
 * Includes provenance metadata for attribution.
 */
export type ContextSource = {
  readonly id: string;
  readonly kind: 'note';
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  readonly provenance: ContextSourceProvenance;
};

export type ContextSourceProvenance = {
  readonly sourceId: string;
  readonly sourceKind: 'note';
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};
