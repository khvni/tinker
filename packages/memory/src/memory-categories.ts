export type MemoryCategoryId =
  | 'People'
  | 'Active Work'
  | 'Capabilities'
  | 'Preferences'
  | 'Organization';

export const PENDING_MEMORY_CATEGORY = 'Pending';

export type MemoryEntryBucket = MemoryCategoryId | typeof PENDING_MEMORY_CATEGORY;

export const MEMORY_CATEGORY_ORDER: readonly MemoryCategoryId[] = [
  'People',
  'Active Work',
  'Capabilities',
  'Preferences',
  'Organization',
] as const;

export const MEMORY_FOLDER_ORDER: readonly MemoryEntryBucket[] = [
  PENDING_MEMORY_CATEGORY,
  ...MEMORY_CATEGORY_ORDER,
] as const;

export const DISMISS_TOMBSTONE_FILE = '.dismissed.log';

const MEMORY_CATEGORY_SET: ReadonlySet<string> = new Set(MEMORY_CATEGORY_ORDER);
const MEMORY_BUCKET_SET: ReadonlySet<string> = new Set(MEMORY_FOLDER_ORDER);

export const isMemoryCategoryId = (value: string): value is MemoryCategoryId => {
  return MEMORY_CATEGORY_SET.has(value);
};

export const isMemoryEntryBucket = (value: string): value is MemoryEntryBucket => {
  return MEMORY_BUCKET_SET.has(value);
};

export const bucketForFrontmatter = (frontmatter: Record<string, unknown>): MemoryCategoryId | null => {
  const rawKind = frontmatter.kind;
  if (typeof rawKind !== 'string') {
    return null;
  }

  const exactFolderName = rawKind.trim();
  return isMemoryCategoryId(exactFolderName) ? exactFolderName : null;
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

  return isMemoryEntryBucket(first) ? first : null;
};
