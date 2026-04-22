import { useMemo, useState, type JSX } from 'react';
import { SearchInput } from '@tinker/design';
import {
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_ORDER,
  type MemoryCategoryId,
  type MemoryEntryBucket,
  type MemoryMarkdownFile,
} from '@tinker/memory';
import './MemorySidebar.css';

export type MemorySidebarProps = {
  buckets: Record<MemoryEntryBucket, MemoryMarkdownFile[]>;
  searchQuery: string;
  onSearchChange: (next: string) => void;
  selectedPath: string | null;
  onSelect: (file: MemoryMarkdownFile, bucket: MemoryEntryBucket) => void;
  seenPaths: ReadonlySet<string>;
  referenceTimeMs?: number | undefined;
};

const RELATIVE_THRESHOLDS: ReadonlyArray<{ seconds: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { seconds: 60, unit: 'second' },
  { seconds: 3600, unit: 'minute' },
  { seconds: 86400, unit: 'hour' },
  { seconds: 2592000, unit: 'day' },
  { seconds: 31536000, unit: 'month' },
  { seconds: Number.POSITIVE_INFINITY, unit: 'year' },
];

const formatRelativeSuffix = (value: string, formatter: Intl.RelativeTimeFormat, now: number): string => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'just now';
  }

  const deltaSeconds = Math.round((timestamp - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const index = RELATIVE_THRESHOLDS.findIndex(({ seconds }) => absoluteSeconds < seconds);
  if (index === -1) {
    return 'just now';
  }

  const threshold = RELATIVE_THRESHOLDS[index]!;
  const divisor = index === 0 ? 1 : RELATIVE_THRESHOLDS[index - 1]!.seconds;
  return formatter.format(Math.round(deltaSeconds / divisor), threshold.unit);
};

const matchesQuery = (file: MemoryMarkdownFile, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }
  return file.name.toLowerCase().includes(query);
};

const ClockIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PeopleIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 13c1-2 2.5-3 5-3s4 1 5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const CheckIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3 3 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 2.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 11.6l-3.6 1.9.7-4L2.2 6.7l4-.6L8 2.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const CrosshairIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const HouseIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.5 7.5L8 3l5.5 4.5V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6.5 13.5V9.5h3v4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const ChevronRightIcon = (): JSX.Element => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDownIcon = (): JSX.Element => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CATEGORY_ICONS: Record<MemoryCategoryId, () => JSX.Element> = {
  people: PeopleIcon,
  'active-work': CheckIcon,
  capabilities: StarIcon,
  preferences: CrosshairIcon,
  organization: HouseIcon,
};

type MemoryPendingRowProps = {
  file: MemoryMarkdownFile;
  isSelected: boolean;
  isNew: boolean;
  relativeSuffix: string;
  onSelect: () => void;
};

const MemoryPendingRow = ({
  file,
  isSelected,
  isNew,
  relativeSuffix,
  onSelect,
}: MemoryPendingRowProps): JSX.Element => (
  <button
    type="button"
    className={`tinker-memory-sidebar__row${isSelected ? ' tinker-memory-sidebar__row--selected' : ''}`}
    title={file.relativePath}
    onClick={onSelect}
  >
    <span className="tinker-memory-sidebar__row-body">
      <span className="tinker-memory-sidebar__row-title">{file.name}</span>
      <span className="tinker-memory-sidebar__row-meta">
        {isNew ? 'New Entry' : 'Update'} &middot; {relativeSuffix}
      </span>
    </span>
    {isNew ? <span className="tinker-memory-sidebar__row-dot" aria-hidden="true" /> : null}
  </button>
);

type CategorySectionProps = {
  category: MemoryCategoryId;
  files: MemoryMarkdownFile[];
  searchQuery: string;
  selectedPath: string | null;
  onSelect: (file: MemoryMarkdownFile) => void;
};

const CategorySection = ({
  category,
  files,
  searchQuery,
  selectedPath,
  onSelect,
}: CategorySectionProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[category];
  const filtered = files.filter((file) => matchesQuery(file, searchQuery));
  const label = MEMORY_CATEGORY_LABELS[category];

  return (
    <div className="tinker-memory-sidebar__section">
      <button
        type="button"
        className="tinker-memory-sidebar__section-header"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <span className="tinker-memory-sidebar__section-caret" aria-hidden="true">
          {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
        <span className="tinker-memory-sidebar__section-icon" aria-hidden="true">
          <CategoryIcon />
        </span>
        <span className="tinker-memory-sidebar__section-label">{label}</span>
        <span className="tinker-memory-sidebar__section-count">{filtered.length}</span>
      </button>
      {isOpen ? (
        <div className="tinker-memory-sidebar__section-body">
          {filtered.length === 0 ? (
            <p className="tinker-memory-sidebar__section-empty">No entries</p>
          ) : (
            filtered.map((file) => (
              <button
                key={file.absolutePath}
                type="button"
                className={`tinker-memory-sidebar__row${
                  selectedPath === file.absolutePath ? ' tinker-memory-sidebar__row--selected' : ''
                }`}
                title={file.relativePath}
                onClick={() => {
                  onSelect(file);
                }}
              >
                <span className="tinker-memory-sidebar__row-body">
                  <span className="tinker-memory-sidebar__row-title">{file.name}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export const MemorySidebar = ({
  buckets,
  searchQuery,
  onSearchChange,
  selectedPath,
  onSelect,
  seenPaths,
  referenceTimeMs,
}: MemorySidebarProps): JSX.Element => {
  const relativeFormatter = useMemo(() => new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }), []);
  const nowMs = useMemo(() => referenceTimeMs ?? Date.now(), [referenceTimeMs]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const pendingFiles = buckets.pending.filter((file) => matchesQuery(file, normalizedQuery));
  const totalFilesAcrossBuckets =
    buckets.pending.length +
    MEMORY_CATEGORY_ORDER.reduce((total, id) => total + buckets[id].length, 0);

  return (
    <aside className="tinker-memory-sidebar" aria-label="Memory entries">
      <div className="tinker-memory-sidebar__search-row">
        <div className="tinker-memory-sidebar__search-field">
          <SearchInput
            value={searchQuery}
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder="Search…"
          />
        </div>
      </div>
      <div className="tinker-memory-sidebar__sections">
        {totalFilesAcrossBuckets === 0 ? (
          <p className="tinker-memory-sidebar__empty">No memory yet</p>
        ) : (
          <>
            <div className="tinker-memory-sidebar__section">
              <div className="tinker-memory-sidebar__section-header tinker-memory-sidebar__section-header--pending">
                <span className="tinker-memory-sidebar__section-icon" aria-hidden="true">
                  <ClockIcon />
                </span>
                <span className="tinker-memory-sidebar__section-label">Pending</span>
                <span className="tinker-memory-sidebar__section-count">{pendingFiles.length}</span>
              </div>
              <div className="tinker-memory-sidebar__section-body">
                {pendingFiles.length === 0 ? (
                  <p className="tinker-memory-sidebar__section-empty">Nothing pending</p>
                ) : (
                  pendingFiles.map((file) => {
                    const isNew = !seenPaths.has(file.absolutePath);
                    const suffix = formatRelativeSuffix(file.modifiedAt, relativeFormatter, nowMs);
                    return (
                      <MemoryPendingRow
                        key={file.absolutePath}
                        file={file}
                        isSelected={selectedPath === file.absolutePath}
                        isNew={isNew}
                        relativeSuffix={suffix}
                        onSelect={() => {
                          onSelect(file, 'pending');
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {MEMORY_CATEGORY_ORDER.map((category) => (
              <CategorySection
                key={category}
                category={category}
                files={buckets[category]}
                searchQuery={normalizedQuery}
                selectedPath={selectedPath}
                onSelect={(file) => {
                  onSelect(file, category);
                }}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
};
