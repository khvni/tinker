export type EntityKind =
  | 'person'
  | 'project'
  | 'document'
  | 'channel'
  | 'ticket'
  | 'account'
  | 'other';

export type EntitySource = {
  integration: string;
  externalId: string;
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
  predicate: 'works_with' | 'owns' | 'mentions' | 'related_to' | string;
  objectId: string;
  confidence: number;
  source: string;
};

export type SessionRef = {
  sessionId: string;
  entityIds: string[];
  summary: string;
  createdAt: string;
};

export type MemorySearchQuery = {
  text?: string;
  kinds?: EntityKind[];
  limit?: number;
};

export type MemorySearchResult = {
  entity: Entity;
  score: number;
};

export type MemoryStore = {
  upsertEntity(entity: Entity): Promise<void>;
  upsertRelationship(rel: Relationship): Promise<void>;
  getEntity(id: string): Promise<Entity | null>;
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;
  recentSessions(userId: string, limit: number): Promise<SessionRef[]>;
  recordSession(ref: SessionRef): Promise<void>;
};

export type MemoryBootstrapInput = {
  userId: string;
  integrations: string[];
};

export type MemoryBootstrapResult = {
  entitiesAdded: number;
  relationshipsAdded: number;
};

export type DailySynthesisResult = {
  entitiesTouched: number;
  summary: string;
};
