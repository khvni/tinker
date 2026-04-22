import type {
  SidebarFlashAccent,
  SidebarStatusEntry,
  SidebarStatusFormat,
  WorkspaceCardAttention,
  WorkspaceCardModel,
} from './types.js';

export type WorkspaceMetadataEntryInput = {
  readonly key: string;
  readonly value?: string;
  readonly priority?: number;
  readonly format?: SidebarStatusFormat;
  readonly timestamp?: number;
  readonly icon?: string;
  readonly color?: string;
  readonly url?: string;
};

export type WorkspaceMetadataAttentionPatch = {
  readonly unread?: boolean;
  readonly flash?: SidebarFlashAccent | null;
};

export type PostWorkspaceMetadataRequest = {
  readonly workspaceId: string;
  readonly title?: string;
  readonly pinned?: boolean;
  readonly attention?: WorkspaceMetadataAttentionPatch;
  readonly entries?: ReadonlyArray<WorkspaceMetadataEntryInput>;
  readonly removeEntryKeys?: ReadonlyArray<string>;
};

export type PostWorkspaceMetadataResponse = {
  readonly card: WorkspaceCardModel;
};

export type GetWorkspaceCardsResponse = {
  readonly cards: ReadonlyArray<WorkspaceCardModel>;
};

export type WorkspaceMetadataListener = (cards: ReadonlyArray<WorkspaceCardModel>) => void;

export type WorkspaceMetadataApi = {
  getWorkspaceCards(): Promise<GetWorkspaceCardsResponse>;
  postWorkspaceMetadata(input: PostWorkspaceMetadataRequest): Promise<PostWorkspaceMetadataResponse>;
  subscribe(listener: WorkspaceMetadataListener): () => void;
  reset(): Promise<void>;
};

export type CreateWorkspaceMetadataApiOptions = {
  readonly initialCards?: ReadonlyArray<WorkspaceCardModel>;
  readonly now?: () => number;
};

type StoredWorkspaceCard = {
  id: string;
  title: string;
  pinned: boolean;
  attention: WorkspaceCardAttention;
  entries: Map<string, SidebarStatusEntry>;
  updatedAt: number;
};

const normalizeString = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return normalizeString(value);
};

const normalizeFormat = (value: SidebarStatusFormat | undefined): SidebarStatusFormat | undefined => {
  if (value === 'plain' || value === 'markdown') {
    return value;
  }

  return undefined;
};

const normalizeAccent = (value: SidebarFlashAccent | null | undefined): SidebarFlashAccent | null | undefined => {
  if (value === null) {
    return null;
  }

  if (value === 'navigation-teal' || value === 'notification-blue') {
    return value;
  }

  return undefined;
};

const cloneAttention = (attention: WorkspaceCardAttention): WorkspaceCardAttention => ({
  unread: attention.unread,
  flash: attention.flash,
});

const sortEntries = (left: SidebarStatusEntry, right: SidebarStatusEntry): number => {
  return left.priority - right.priority || left.key.localeCompare(right.key);
};

const sortCards = (left: StoredWorkspaceCard, right: StoredWorkspaceCard): number => {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  return left.title.localeCompare(right.title);
};

const cloneEntry = (entry: SidebarStatusEntry): SidebarStatusEntry => ({
  key: entry.key,
  value: entry.value,
  priority: entry.priority,
  format: entry.format,
  timestamp: entry.timestamp,
  ...(entry.icon ? { icon: entry.icon } : {}),
  ...(entry.color ? { color: entry.color } : {}),
  ...(entry.url ? { url: entry.url } : {}),
});

const toWorkspaceCardModel = (card: StoredWorkspaceCard): WorkspaceCardModel => ({
  id: card.id,
  title: card.title,
  pinned: card.pinned,
  attention: cloneAttention(card.attention),
  entries: Array.from(card.entries.values()).sort(sortEntries).map(cloneEntry),
});

const getEntryTimestamp = (entries: ReadonlyArray<SidebarStatusEntry>): number => {
  return entries.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0);
};

const toStoredWorkspaceCard = (card: WorkspaceCardModel): StoredWorkspaceCard => ({
  id: card.id,
  title: card.title,
  pinned: card.pinned,
  attention: cloneAttention(card.attention),
  entries: new Map(card.entries.map((entry) => [entry.key, cloneEntry(entry)])),
  updatedAt: getEntryTimestamp(card.entries),
});

const equalEntry = (left: SidebarStatusEntry, right: SidebarStatusEntry): boolean => {
  return (
    left.key === right.key &&
    left.value === right.value &&
    left.priority === right.priority &&
    left.format === right.format &&
    left.timestamp === right.timestamp &&
    left.icon === right.icon &&
    left.color === right.color &&
    left.url === right.url
  );
};

const mergeEntry = (
  existing: SidebarStatusEntry | undefined,
  patch: WorkspaceMetadataEntryInput,
  now: number,
): SidebarStatusEntry | null => {
  const key = normalizeString(patch.key);
  if (!key) {
    return existing ?? null;
  }

  const nextValue =
    patch.value !== undefined
      ? normalizeOptionalString(patch.value)
      : existing?.value;

  if (!nextValue) {
    return null;
  }

  const hasPriority = typeof patch.priority === 'number' && Number.isFinite(patch.priority);
  const hasTimestamp = typeof patch.timestamp === 'number' && Number.isFinite(patch.timestamp);
  const icon = 'icon' in patch ? normalizeOptionalString(patch.icon) : existing?.icon;
  const color = 'color' in patch ? normalizeOptionalString(patch.color) : existing?.color;
  const url = 'url' in patch ? normalizeOptionalString(patch.url) : existing?.url;

  return {
    key,
    value: nextValue,
    priority: hasPriority ? patch.priority : existing?.priority ?? 0,
    format: normalizeFormat(patch.format) ?? existing?.format ?? 'plain',
    timestamp: hasTimestamp ? patch.timestamp : now,
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
    ...(url ? { url } : {}),
  };
};

export const createWorkspaceMetadataApi = (
  options: CreateWorkspaceMetadataApiOptions = {},
): WorkspaceMetadataApi => {
  const now = options.now ?? (() => Date.now());
  const cards = new Map<string, StoredWorkspaceCard>(
    (options.initialCards ?? []).map((card) => [card.id, toStoredWorkspaceCard(card)]),
  );
  const listeners = new Set<WorkspaceMetadataListener>();

  const getSnapshot = (): ReadonlyArray<WorkspaceCardModel> => {
    return Array.from(cards.values()).sort(sortCards).map(toWorkspaceCardModel);
  };

  const notify = (): void => {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  return {
    async getWorkspaceCards(): Promise<GetWorkspaceCardsResponse> {
      return { cards: getSnapshot() };
    },

    async postWorkspaceMetadata(input: PostWorkspaceMetadataRequest): Promise<PostWorkspaceMetadataResponse> {
      const workspaceId = normalizeString(input.workspaceId);
      if (!workspaceId) {
        throw new Error('workspaceId is required for POST /workspace.metadata.');
      }

      const nextUpdatedAt = now();
      const existing = cards.get(workspaceId);
      const card: StoredWorkspaceCard =
        existing ??
        ({
          id: workspaceId,
          title: normalizeOptionalString(input.title) ?? workspaceId,
          pinned: input.pinned ?? false,
          attention: {
            unread: input.attention?.unread ?? false,
            flash: normalizeAccent(input.attention?.flash) ?? null,
          },
          entries: new Map<string, SidebarStatusEntry>(),
          updatedAt: nextUpdatedAt,
        } satisfies StoredWorkspaceCard);

      let changed = existing === undefined;

      const nextTitle = normalizeOptionalString(input.title);
      if (nextTitle && nextTitle !== card.title) {
        card.title = nextTitle;
        changed = true;
      }

      if (typeof input.pinned === 'boolean' && input.pinned !== card.pinned) {
        card.pinned = input.pinned;
        changed = true;
      }

      if (input.attention) {
        if (typeof input.attention.unread === 'boolean' && input.attention.unread !== card.attention.unread) {
          card.attention = {
            ...card.attention,
            unread: input.attention.unread,
          };
          changed = true;
        }

        if ('flash' in input.attention) {
          const flash = normalizeAccent(input.attention.flash);
          if (flash !== undefined && flash !== card.attention.flash) {
            card.attention = {
              ...card.attention,
              flash,
            };
            changed = true;
          }
        }
      }

      for (const removeKey of input.removeEntryKeys ?? []) {
        const normalizedKey = normalizeString(removeKey);
        if (!normalizedKey) {
          continue;
        }

        if (card.entries.delete(normalizedKey)) {
          changed = true;
        }
      }

      for (const entryPatch of input.entries ?? []) {
        const normalizedKey = normalizeString(entryPatch.key);
        if (!normalizedKey) {
          continue;
        }

        const existingEntry = card.entries.get(normalizedKey);
        const nextEntry = mergeEntry(existingEntry, entryPatch, nextUpdatedAt);

        if (!nextEntry) {
          if (card.entries.delete(normalizedKey)) {
            changed = true;
          }
          continue;
        }

        if (!existingEntry || !equalEntry(existingEntry, nextEntry)) {
          card.entries.set(normalizedKey, nextEntry);
          changed = true;
        }
      }

      if (changed) {
        card.updatedAt = Math.max(card.updatedAt, nextUpdatedAt, getEntryTimestamp(Array.from(card.entries.values())));
        cards.set(workspaceId, card);
        notify();
      }

      return { card: toWorkspaceCardModel(card) };
    },

    subscribe(listener: WorkspaceMetadataListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async reset(): Promise<void> {
      if (cards.size === 0) {
        return;
      }

      cards.clear();
      notify();
    },
  };
};
