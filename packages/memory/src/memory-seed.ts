import {
  bucketForFrontmatter,
  bucketForRelativePath,
  PENDING_MEMORY_CATEGORY,
  type MemoryCategoryId,
  type MemoryEntryBucket,
} from './memory-categories.js';
import type { CategorisedMemoryFiles, MemoryMarkdownFile } from './memory-files.js';
import { deriveNoteTitle, parseFrontmatter, serializeFrontmatter } from './vault-utils.js';

export type SeededMemoryNote = {
  relativePath: string;
  modifiedAt: string;
  text: string;
};

export type DemoMemoryPreview = {
  categorised: CategorisedMemoryFiles;
  selection: {
    bucket: MemoryEntryBucket;
    file: MemoryMarkdownFile;
  };
  markdownByAbsolutePath: Record<string, string>;
};

export const DEMO_MEMORY_REFERENCE_TIME_MS = Date.parse('2026-04-22T14:00:00.000Z');
export const DEMO_MEMORY_SELECTED_RELATIVE_PATH = 'Pending/synthesis-auto-20260408-glass-article.md';

const stubText = (title: string, detail: string): string => `# ${title}

${detail}
`;

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
};

const createSeedNote = (
  relativePath: string,
  modifiedAt: string,
  body: string,
  frontmatter: Record<string, unknown> = {},
): SeededMemoryNote => ({
  relativePath,
  modifiedAt,
  text: serializeFrontmatter(frontmatter, body.trimEnd()),
});

const createStubNotes = (
  directory: string,
  titles: readonly string[],
  modifiedAt: string,
  category: MemoryCategoryId | null = null,
): SeededMemoryNote[] => {
  return titles.map((title) =>
    createSeedNote(
      `${directory}/${slugify(title)}.md`,
      modifiedAt,
      stubText(title, `Seeded memory note for ${title}. Replace or delete once real notes exist.`),
      category ? { kind: category } : {},
    ),
  );
};

const PEOPLE_TITLES = [
  'Seb Goddijn',
  'Khani Bangalu',
  'Ada Lovelace',
  'Grace Hopper',
  'Margaret Hamilton',
  'Ken Thompson',
  'Linus Torvalds',
  'Leslie Lamport',
  'Rich Hickey',
  'Whitney Wolfe Herd',
  'Melanie Perkins',
  'Patrick Collison',
  'Tope Awotona',
  'Gergely Orosz',
  'Tobi Lutke',
  'Aravind Srinivas',
  'Dylan Patel',
  'Jeff Dean',
  'Fei-Fei Li',
  'Greg Brockman',
  'Mira Murati',
  'Sam Altman',
  'Emmett Shear',
  'Nat Friedman',
  'Elena Verna',
  'Julie Zhuo',
  'Charity Majors',
] as const;

const ACTIVE_WORK_TITLES = [
  'Agent Memory Rollout',
  'Workspace Shell Parity',
  'Context Badge Review',
  'Folder Picker UX',
  'MCP Status Polish',
  'Model Picker Audit',
  'Docs Smoke Test',
  'Guest Mode Cleanup',
  'Release Checklist',
] as const;

const CAPABILITY_TITLES = [
  'Visual Regression Reviews',
  'Local-First Agent Tooling',
] as const;

const PREFERENCE_TITLES = [
  'Prefer light mode for long sessions',
  'Use Host Grotesk for UI copy',
  'Keep memory notes human-readable',
  'Default to concise status updates',
  'Favor deletion before abstraction',
  'Use markdown for durable notes',
  'Keep approval flows reversible',
] as const;

const ORGANIZATION_TITLES = [
  'Tinker MVP Scope',
  'Project Glass Reference Set',
] as const;

const SELECTED_CHANGES_PREVIEW = `Series of essays exploring how AI agents reshape software, product strategy, and competitive moats, written
in Notion with local drafts in \`~/writing/\`.

**Published/completed:**
- "Fixing Europe's AI Strategy Before It's Too Late" (Feb 2025) — argues Europe should focus on AI adoption
  and deregulation over infrastructure spend.
- "Why agents erode software's oldest moat" (Jan 2026) — agents eliminate interface complexity moats by
  collapsing navigation into natural language. Uses expense management as running example.
- "Start Shipping Intelligence" (Jan 2026) — companies should let customers build their own agents and ship
  proprietary intelligence layers around APIs.

**Active draft:** "The Agent Builder's Playbook" — evolved thesis: "Building AI for your customers is an
information architecture problem." Structured around a 4-layer model:`;

export const DEMO_MEMORY_NOTES: readonly SeededMemoryNote[] = [
  createSeedNote(
    'Pending/glass-scheduled-doc-map.md',
    '2026-04-21T16:00:00.000Z',
    stubText(
      'Glass Scheduled Doc Map',
      'Overview of upcoming Glass writing and maintenance work queued for review.',
    ),
    { kind: 'Organization' },
  ),
  createSeedNote(
    DEMO_MEMORY_SELECTED_RELATIVE_PATH,
    '2026-04-21T14:00:00.000Z',
    `# Writing Articles on AI Agents and Software Strategy

New article actively in progress (Apr 8): "Glass — Every Knowledge Worker Deserves an AI Agent." Notion page 33c3d1a93361819ea948c6cde3c5e24d is source of truth, with local mirror at ~/ramp-claude-desktop/glass-article-draft.md. Three core principles articulated: (1) the capability ceiling stays high, (2) one person's breakthrough is everyone's baseline, (3) the best teacher is the tool itself. Draws language from the Internal AI Roadmap ("stressed and scattered adoption," "urgency without structure," "connective tissue"). Intended for external publication. Multiple sessions dedicated to drafting, iterating structure, and capturing screenshots via Servo.
`,
    {
      kind: 'Active Work',
      display_path:
        '/Users/seb.goddijn/project-glass/memory/Pending/synthesis-auto-20260408-glass-article.md',
      changes: SELECTED_CHANGES_PREVIEW,
    },
  ),
  createSeedNote(
    'Pending/project-glass.md',
    '2026-04-21T12:00:00.000Z',
    stubText('Project Glass', 'Working summary for the local-first AI workspace reference project.'),
    { kind: 'Organization' },
  ),
  createSeedNote(
    'Pending/ai-hackathon-planning.md',
    '2026-04-21T10:00:00.000Z',
    stubText('AI Hackathon Planning', 'Draft brief for a short internal hackathon focused on agent UX.'),
    { kind: 'Active Work' },
  ),
  ...createStubNotes('People', PEOPLE_TITLES, '2026-04-20T12:00:00.000Z', 'People'),
  ...createStubNotes('Active Work', ACTIVE_WORK_TITLES, '2026-04-20T12:00:00.000Z', 'Active Work'),
  ...createStubNotes('Capabilities', CAPABILITY_TITLES, '2026-04-20T12:00:00.000Z', 'Capabilities'),
  ...createStubNotes('Preferences', PREFERENCE_TITLES, '2026-04-20T12:00:00.000Z', 'Preferences'),
  ...createStubNotes('Organization', ORGANIZATION_TITLES, '2026-04-20T12:00:00.000Z', 'Organization'),
] as const;

const readFrontmatterString = (
  frontmatter: Record<string, unknown>,
  ...keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = frontmatter[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const toPreviewFile = (rootPath: string, note: SeededMemoryNote): MemoryMarkdownFile => {
  const absolutePath = `${rootPath}/${note.relativePath}`;
  const { frontmatter, body } = parseFrontmatter(note.text);
  const bucket = bucketForRelativePath(note.relativePath);
  const category =
    bucketForFrontmatter(frontmatter) ??
    (bucket && bucket !== PENDING_MEMORY_CATEGORY ? bucket : null);

  return {
    absolutePath,
    relativePath: note.relativePath,
    name: note.relativePath.split('/').at(-1) ?? note.relativePath,
    title: deriveNoteTitle(note.relativePath, frontmatter, body),
    modifiedAt: note.modifiedAt,
    category,
    displayPath: readFrontmatterString(frontmatter, 'display_path', 'displayPath') ?? absolutePath,
    changesPreview:
      readFrontmatterString(frontmatter, 'changes', 'changes_preview', 'changesPreview') ?? null,
  };
};

const sortNewestFirst = (left: SeededMemoryNote, right: SeededMemoryNote): number => {
  return (
    Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt) ||
    left.relativePath.localeCompare(right.relativePath)
  );
};

export const createDemoMemoryPreview = (rootPath = '/memory/demo'): DemoMemoryPreview => {
  const buckets: Record<MemoryEntryBucket, MemoryMarkdownFile[]> = {
    Pending: [],
    People: [],
    'Active Work': [],
    Capabilities: [],
    Preferences: [],
    Organization: [],
  };
  const markdownByAbsolutePath: Record<string, string> = {};

  for (const note of [...DEMO_MEMORY_NOTES].sort(sortNewestFirst)) {
    const bucket = bucketForRelativePath(note.relativePath);
    if (!bucket) {
      continue;
    }

    const file = toPreviewFile(rootPath, note);
    buckets[bucket].push(file);
    markdownByAbsolutePath[file.absolutePath] = note.text;
  }

  const selected = buckets.Pending.find(
    (file) => file.relativePath === DEMO_MEMORY_SELECTED_RELATIVE_PATH,
  );
  if (!selected) {
    throw new Error('Demo memory preview is missing the selected Paper seed note.');
  }

  return {
    categorised: {
      rootPath,
      buckets,
    },
    selection: {
      bucket: 'Pending',
      file: selected,
    },
    markdownByAbsolutePath,
  };
};

export const DEMO_MEMORY_PREVIEW = createDemoMemoryPreview();
