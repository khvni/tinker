export type MemoryCategoryId =
  | 'people'
  | 'active-work'
  | 'capabilities'
  | 'preferences'
  | 'organization';

export type MemoryEntryBucket = MemoryCategoryId | 'pending';

export const MEMORY_CATEGORY_ORDER: readonly MemoryCategoryId[] = [
  'people',
  'active-work',
  'capabilities',
  'preferences',
  'organization',
] as const;

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategoryId, string> = {
  people: 'People',
  'active-work': 'Active Work',
  capabilities: 'Capabilities',
  preferences: 'Preferences',
  organization: 'Organization',
};

export const MEMORY_CATEGORY_DIRECTORIES: Record<MemoryCategoryId, string> = {
  people: 'people',
  'active-work': 'active-work',
  capabilities: 'capabilities',
  preferences: 'preferences',
  organization: 'organization',
};

export const PENDING_DIRECTORY = 'pending';

export const DISMISS_TOMBSTONE_FILE = '.dismissed.log';

const CATEGORY_DIRECTORY_LOOKUP: ReadonlyMap<string, MemoryCategoryId> = new Map(
  MEMORY_CATEGORY_ORDER.map((id) => [MEMORY_CATEGORY_DIRECTORIES[id], id] as const),
);

const normalizeKindToken = (value: string): string => {
  return value.trim().toLowerCase().replace(/[_\s]+/gu, '-');
};

const CANONICAL_KIND_LOOKUP: ReadonlyMap<string, MemoryCategoryId> = new Map(
  MEMORY_CATEGORY_ORDER.map((id) => [id, id] as const),
);

export const bucketForFrontmatter = (
  frontmatter: Record<string, unknown>,
): MemoryCategoryId | null => {
  const rawKind = frontmatter.kind;
  if (typeof rawKind !== 'string') {
    return null;
  }

  const normalized = normalizeKindToken(rawKind);
  if (normalized.length === 0) {
    return null;
  }

  return CANONICAL_KIND_LOOKUP.get(normalized) ?? null;
};

export const bucketForRelativePath = (relativePath: string): MemoryEntryBucket | null => {
  const segments = relativePath
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const first = segments[0];
  if (!first) {
    return null;
  }

  if (first === PENDING_DIRECTORY) {
    return 'pending';
  }

  return CATEGORY_DIRECTORY_LOOKUP.get(first) ?? null;
};
