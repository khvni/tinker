export type EntityKind =
  | 'person'
  | 'project'
  | 'document'
  | 'channel'
  | 'ticket'
  | 'account'
  | 'concept'
  | 'organization'
  | 'tool'
  | 'event'
  | 'other';

export type EntitySource = {
  service: string;
  ref: string;
  lastSeen: string;
  url?: string;
};

export type Entity = {
  id: string;
  kind: EntityKind;
  name: string;
  aliases: string[];
  sources: EntitySource[];
  attributes: Record<string, unknown>;
  lastSeenAt: string;
};

export type Relationship = {
  subjectId: string;
  predicate: string;
  objectId: string;
  confidence: number;
  sources: EntitySource[];
};

export type MemorySearchResult = {
  entity: Entity;
  score: number;
};

export type MemoryStore = {
  upsertEntity(entity: Entity): Promise<void>;
  upsertRelationship(rel: Relationship): Promise<void>;
  getEntity(id: string): Promise<Entity | null>;
  search(query: string, limit?: number): Promise<MemorySearchResult[]>;
  recentEntities(limit: number): Promise<Entity[]>;
};
