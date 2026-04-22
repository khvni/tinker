import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SKILL_VERSION } from '@tinker/shared-types';

// Tauri FS + DB plugin shims: these back skill-service.ts which otherwise
// imports native bindings unavailable in Node.
const {
  mockCopyFile,
  mockExists,
  mockMkdir,
  mockReadTextFile,
  mockRemove,
  mockStat,
  mockWriteTextFile,
} = vi.hoisted(() => ({
  mockCopyFile: vi.fn<(source: string, destination: string) => Promise<void>>(),
  mockExists: vi.fn<(path: string) => Promise<boolean>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockRemove: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockStat: vi.fn<(path: string) => Promise<{ mtime?: Date | null; isDirectory: boolean; isFile: boolean }>>(),
  mockWriteTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: mockCopyFile,
  exists: mockExists,
  mkdir: mockMkdir,
  readTextFile: mockReadTextFile,
  remove: mockRemove,
  stat: mockStat,
  writeTextFile: mockWriteTextFile,
}));

type FakeDatabase = {
  execute(query: string, bindValues?: unknown[]): Promise<void>;
  select<TRow>(query: string, bindValues?: unknown[]): Promise<TRow>;
};

// Minimal in-memory SQL shim that understands only the queries the skill
// service issues. Keeps the test focused on the round-trip contract rather
// than the FTS query surface area.
type SkillRow = {
  slug: string;
  title: string;
  description: string;
  tools_json: string;
  tags_json: string;
  relative_path: string;
  frontmatter_json: string;
  body: string;
  last_modified: string;
  active: number;
  installed_at: string;
};

const createFakeDatabase = (): FakeDatabase => {
  const rows = new Map<string, SkillRow>();
  const fts = new Map<string, Record<string, string>>();
  const gitConfigRows = new Map<number, Record<string, unknown>>();

  return {
    async execute(query: string, bindValues: unknown[] = []): Promise<void> {
      if (query.startsWith('INSERT INTO skills_fts')) {
        const [slug, title, description, tags, tools, body] = bindValues as [
          string, string, string, string, string, string,
        ];
        fts.set(slug, { slug, title, description, tags, tools, body });
        return;
      }

      if (query.startsWith('INSERT INTO skills')) {
        const [
          slug,
          title,
          description,
          toolsJson,
          tagsJson,
          relativePath,
          frontmatterJson,
          body,
          lastModified,
          active,
          installedAt,
        ] = bindValues as [
          string, string, string, string, string, string, string, string, string, number, string,
        ];

        rows.set(slug, {
          slug,
          title,
          description,
          tools_json: toolsJson,
          tags_json: tagsJson,
          relative_path: relativePath,
          frontmatter_json: frontmatterJson,
          body,
          last_modified: lastModified,
          active,
          installed_at: installedAt,
        });
        return;
      }

      if (query.startsWith('UPDATE skills SET active =')) {
        const [active, slug] = bindValues as [number, string];
        const existing = rows.get(slug);
        if (existing) {
          rows.set(slug, { ...existing, active });
        }
        return;
      }

      if (query.startsWith('DELETE FROM skills_fts')) {
        const [slug] = bindValues as [string];
        fts.delete(slug);
        return;
      }

      if (query.startsWith('DELETE FROM skills')) {
        const [slug] = bindValues as [string];
        rows.delete(slug);
        return;
      }

      if (query.includes('skill_git_config')) {
        if (query.startsWith('DELETE FROM skill_git_config')) {
          gitConfigRows.delete(1);
          return;
        }
        const [remoteUrl, branch, authorName, authorEmail, updatedAt] = bindValues as [
          string, string, string | null, string | null, string,
        ];
        gitConfigRows.set(1, {
          remote_url: remoteUrl,
          branch,
          author_name: authorName,
          author_email: authorEmail,
          updated_at: updatedAt,
        });
        return;
      }
    },

    async select<TRow>(query: string, bindValues: unknown[] = []): Promise<TRow> {
      if (query.includes('FROM skills WHERE slug =')) {
        const [slug] = bindValues as [string];
        const row = rows.get(slug);
        return (row ? [row] : []) as unknown as TRow;
      }

      if (query.includes('FROM skills WHERE active = 1')) {
        return ([...rows.values()].filter((row) => row.active === 1)) as unknown as TRow;
      }

      if (query.startsWith('SELECT slug FROM skills')) {
        return ([...rows.values()].map((row) => ({ slug: row.slug }))) as unknown as TRow;
      }

      if (query.includes('FROM skills ORDER BY title')) {
        return ([...rows.values()].sort((left, right) => left.title.localeCompare(right.title))) as unknown as TRow;
      }

      if (query.includes('FROM skill_git_config')) {
        const row = gitConfigRows.get(1);
        return (row ? [row] : []) as unknown as TRow;
      }

      // bm25 + FTS search path — return empty to keep the test deterministic;
      // the round-trip case does not exercise full-text search.
      return [] as unknown as TRow;
    },
  };
};

const fakeDatabase = createFakeDatabase();

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(async () => fakeDatabase),
}));

// Import after mocks are installed so the module picks up the stubs.
const { createSkillStore } = await import('./skill-service.js');

describe('SkillStore round-trip', () => {
  it('installs a draft, lists it, toggles active, and surfaces it in getActive', async () => {
    mockExists.mockResolvedValue(true);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({
      mtime: new Date('2026-04-22T10:00:00.000Z'),
      isDirectory: false,
      isFile: true,
    });

    const store = createSkillStore();
    await store.init('/memory/google:user-1');

    const draft = {
      slug: 'gong-call-analysis',
      title: 'Gong Call Analysis',
      description: 'Analyze a Gong call transcript and surface coaching moments.',
      role: 'sales',
      body: '# Gong Call Analysis\n\nStep 1.\n',
      tools: ['gmail'],
      tags: ['sales'],
    };

    const installed = await store.installFromDraft(draft);
    expect(installed.slug).toBe('gong-call-analysis');
    expect(installed.active).toBe(false);
    expect(installed.version).toBe(DEFAULT_SKILL_VERSION);

    // Ensure writeTextFile was called with the per-user memory path + slug.md.
    const writeArgs = mockWriteTextFile.mock.calls.at(-1);
    expect(writeArgs?.[0]).toContain('/memory/google:user-1');
    expect(writeArgs?.[0]).toMatch(/\.tinker[\\/]skills[\\/]gong-call-analysis\.md$/u);

    const listed = await store.list();
    expect(listed.map((skill) => skill.slug)).toEqual(['gong-call-analysis']);

    const fetched = await store.get('gong-call-analysis');
    expect(fetched?.title).toBe('Gong Call Analysis');

    await store.setActive('gong-call-analysis', true);

    const active = await store.getActive();
    expect(active.map((skill) => skill.slug)).toEqual(['gong-call-analysis']);
    expect(active[0]?.active).toBe(true);
  });
});
