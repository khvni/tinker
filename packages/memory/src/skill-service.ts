import { copyFile, exists, mkdir, readTextFile, remove, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import type { RoleProfile, Skill, SkillDraft, SkillGitConfig, SkillSearchResult, SkillStore } from '@tinker/shared-types';
import { DEFAULT_SKILL_VERSION, SKILLS_VAULT_DIRECTORY } from '@tinker/shared-types';
import { getDatabase } from './database.js';
import {
  draftToSkillContent,
  isSkillRelativePath,
  parseSkillFile,
  serializeSkill,
  skillRelativePath,
  slugFromRelativePath,
} from './skill-parser.js';
import { inferRoleProfile } from './role-profile.js';
import { resolveVaultPath, walkMarkdownFiles } from './vault-utils.js';

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

const hydrateSkill = (row: SkillRow): Skill => {
  const frontmatter = JSON.parse(row.frontmatter_json) as Skill['frontmatter'];
  const role = typeof frontmatter.role === 'string' && frontmatter.role.trim().length > 0 ? frontmatter.role.trim() : null;
  const version =
    typeof frontmatter.version === 'string' && frontmatter.version.trim().length > 0
      ? frontmatter.version.trim()
      : DEFAULT_SKILL_VERSION;
  const author =
    typeof frontmatter.author === 'string' && frontmatter.author.trim().length > 0 ? frontmatter.author.trim() : null;

  return {
    id: typeof frontmatter.id === 'string' && frontmatter.id.trim().length > 0 ? frontmatter.id.trim() : row.slug,
    slug: row.slug,
    title: row.title,
    role,
    description: row.description,
    tools: JSON.parse(row.tools_json) as string[],
    tags: JSON.parse(row.tags_json) as string[],
    version,
    author,
    body: row.body,
    relativePath: row.relative_path,
    frontmatter,
    lastModified: row.last_modified,
    active: row.active === 1,
    installedAt: row.installed_at,
  };
};

const tokenizeFtsQuery = (query: string): string | null => {
  const terms = query
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ');
};

export const createSkillStore = (): SkillStore => {
  let vaultPath: string | null = null;

  const requireVault = (): string => {
    if (!vaultPath) {
      throw new Error('SkillStore.init must be called before using the skill store.');
    }

    return vaultPath;
  };

  const skillsDirectory = (): string => {
    return resolveVaultPath(requireVault(), SKILLS_VAULT_DIRECTORY);
  };

  const absoluteSkillPath = (relativePath: string): string => {
    return resolveVaultPath(requireVault(), relativePath);
  };

  const ensureSkillsDirectory = async (): Promise<void> => {
    const directory = skillsDirectory();
    if (!(await exists(directory))) {
      await mkdir(directory, { recursive: true });
    }
  };

  const upsertSkillRow = async (skill: Skill): Promise<void> => {
    const database = await getDatabase();

    await database.execute(
      `INSERT INTO skills (
         slug, title, description, tools_json, tags_json, relative_path,
         frontmatter_json, body, last_modified, active, installed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         tools_json = excluded.tools_json,
         tags_json = excluded.tags_json,
         relative_path = excluded.relative_path,
         frontmatter_json = excluded.frontmatter_json,
         body = excluded.body,
         last_modified = excluded.last_modified`,
      [
        skill.slug,
        skill.title,
        skill.description,
        JSON.stringify(skill.tools),
        JSON.stringify(skill.tags),
        skill.relativePath,
        JSON.stringify(skill.frontmatter),
        skill.body,
        skill.lastModified,
        skill.active ? 1 : 0,
        skill.installedAt,
      ],
    );

    await database.execute('DELETE FROM skills_fts WHERE slug = $1', [skill.slug]);
    await database.execute(
      'INSERT INTO skills_fts (slug, title, description, tags, tools, body) VALUES ($1, $2, $3, $4, $5, $6)',
      [skill.slug, skill.title, skill.description, skill.tags.join(' '), skill.tools.join(' '), skill.body],
    );
  };

  const deleteSkillRow = async (slug: string): Promise<void> => {
    const database = await getDatabase();
    await database.execute('DELETE FROM skills WHERE slug = $1', [slug]);
    await database.execute('DELETE FROM skills_fts WHERE slug = $1', [slug]);
  };

  const readSkillRow = async (slug: string): Promise<Skill | null> => {
    const database = await getDatabase();
    const rows = await database.select<SkillRow[]>('SELECT * FROM skills WHERE slug = $1 LIMIT 1', [slug]);
    const row = rows[0];
    return row ? hydrateSkill(row) : null;
  };

  const readAllRows = async (): Promise<Skill[]> => {
    const database = await getDatabase();
    const rows = await database.select<SkillRow[]>('SELECT * FROM skills ORDER BY title COLLATE NOCASE ASC');
    return rows.map(hydrateSkill);
  };

  const loadSkillFromDisk = async (relativePath: string): Promise<Skill | null> => {
    const absolutePath = absoluteSkillPath(relativePath);
    if (!(await exists(absolutePath))) {
      return null;
    }

    const text = await readTextFile(absolutePath);
    const info = await stat(absolutePath);
    const fallbackSlug = slugFromRelativePath(relativePath);
    const parsed = parseSkillFile(text, fallbackSlug);
    const previous = await readSkillRow(parsed.slug);

    return {
      id: parsed.id,
      slug: parsed.slug,
      title: parsed.title,
      role: parsed.role,
      description: parsed.description,
      tools: parsed.tools,
      tags: parsed.tags,
      version: parsed.version,
      author: parsed.author,
      body: parsed.body,
      relativePath,
      frontmatter: parsed.frontmatter,
      lastModified: info.mtime?.toISOString() ?? new Date().toISOString(),
      active: previous?.active ?? false,
      installedAt: previous?.installedAt ?? new Date().toISOString(),
    };
  };

  const writeSkillToVault = async (relativePath: string, frontmatter: Skill['frontmatter'], body: string): Promise<void> => {
    await ensureSkillsDirectory();
    await writeTextFile(absoluteSkillPath(relativePath), serializeSkill(frontmatter, body));
  };

  return {
    async init(next: string): Promise<void> {
      vaultPath = next;
      await ensureSkillsDirectory();
    },

    async list(): Promise<Skill[]> {
      return readAllRows();
    },

    async get(slug: string): Promise<Skill | null> {
      return readSkillRow(slug);
    },

    async search(query: string, limit = 12): Promise<SkillSearchResult[]> {
      const database = await getDatabase();
      const tokenized = tokenizeFtsQuery(query);

      if (!tokenized) {
        return [];
      }

      const rows = await database.select<Array<SkillRow & { rank: number }>>(
        `SELECT
           s.*,
           bm25(skills_fts) AS rank
         FROM skills_fts
         JOIN skills s ON s.slug = skills_fts.slug
         WHERE skills_fts MATCH $1
         ORDER BY rank
         LIMIT $2`,
        [tokenized, limit],
      );

      return rows.map((row) => ({
        skill: hydrateSkill(row),
        score: 1 / (1 + Math.max(row.rank, 0)),
      }));
    },

    async getActive(): Promise<Skill[]> {
      const database = await getDatabase();
      const rows = await database.select<SkillRow[]>(
        'SELECT * FROM skills WHERE active = 1 ORDER BY title COLLATE NOCASE ASC',
      );
      return rows.map(hydrateSkill);
    },

    async getRoleProfile(connectedTools): Promise<RoleProfile> {
      const skills = await readAllRows();
      return inferRoleProfile({ connectedTools, skills });
    },

    async setActive(slug: string, active: boolean): Promise<void> {
      const database = await getDatabase();
      await database.execute('UPDATE skills SET active = $1 WHERE slug = $2', [active ? 1 : 0, slug]);
    },

    async installFromFile(sourceAbsolutePath: string): Promise<Skill> {
      requireVault();

      if (!(await exists(sourceAbsolutePath))) {
        throw new Error(`Source skill file does not exist: ${sourceAbsolutePath}`);
      }

      const sourceText = await readTextFile(sourceAbsolutePath);
      const fallbackSlug = sourceAbsolutePath.split(/[\\/]/u).pop()?.replace(/\.md$/iu, '') ?? 'skill';
      const parsed = parseSkillFile(sourceText, fallbackSlug);
      const relativePath = skillRelativePath(parsed.slug);
      const destinationAbsolutePath = absoluteSkillPath(relativePath);

      await ensureSkillsDirectory();
      await copyFile(sourceAbsolutePath, destinationAbsolutePath);

      const info = await stat(destinationAbsolutePath);
      const skill: Skill = {
        id: parsed.id,
        slug: parsed.slug,
        title: parsed.title,
        role: parsed.role,
        description: parsed.description,
        tools: parsed.tools,
        tags: parsed.tags,
        version: parsed.version,
        author: parsed.author,
        body: parsed.body,
        relativePath,
        frontmatter: parsed.frontmatter,
        lastModified: info.mtime?.toISOString() ?? new Date().toISOString(),
        active: false,
        installedAt: new Date().toISOString(),
      };

      await upsertSkillRow(skill);
      return skill;
    },

    async installFromDraft(draft: SkillDraft): Promise<Skill> {
      requireVault();

      const { frontmatter, body, slug } = draftToSkillContent(draft);
      const relativePath = skillRelativePath(slug);
      await writeSkillToVault(relativePath, frontmatter, body);

      const info = await stat(absoluteSkillPath(relativePath));
      const parsed = parseSkillFile(serializeSkill(frontmatter, body), slug);
      const previous = await readSkillRow(slug);
      const skill: Skill = {
        id: parsed.id,
        slug: parsed.slug,
        title: parsed.title,
        role: parsed.role,
        description: parsed.description,
        tools: parsed.tools,
        tags: parsed.tags,
        version: parsed.version,
        author: parsed.author,
        body: parsed.body,
        relativePath,
        frontmatter: parsed.frontmatter,
        lastModified: info.mtime?.toISOString() ?? new Date().toISOString(),
        active: previous?.active ?? false,
        installedAt: previous?.installedAt ?? new Date().toISOString(),
      };

      await upsertSkillRow(skill);
      return skill;
    },

    async uninstall(slug: string): Promise<void> {
      const existing = await readSkillRow(slug);
      if (!existing) {
        return;
      }

      const absolutePath = absoluteSkillPath(existing.relativePath);
      if (await exists(absolutePath)) {
        await remove(absolutePath);
      }

      await deleteSkillRow(slug);
    },

    async reindex(): Promise<{ skillsIndexed: number }> {
      const database = await getDatabase();
      const directory = skillsDirectory();

      if (!(await exists(directory))) {
        await ensureSkillsDirectory();
        const stale = await database.select<Array<{ slug: string }>>('SELECT slug FROM skills');
        await Promise.all(stale.map((row) => deleteSkillRow(row.slug)));
        return { skillsIndexed: 0 };
      }

      const files = await walkMarkdownFiles(directory);
      const nextSlugs = new Set<string>();
      const vaultRoot = requireVault();
      let indexed = 0;
      let hadFailure = false;

      for (const absolutePath of files) {
        const relativePath = absolutePath.slice(vaultRoot.length + 1).replace(/\\/gu, '/');

        if (!isSkillRelativePath(relativePath)) {
          continue;
        }

        try {
          const skill = await loadSkillFromDisk(relativePath);
          if (!skill) {
            continue;
          }

          await upsertSkillRow(skill);
          nextSlugs.add(skill.slug);
          indexed += 1;
        } catch (error) {
          hadFailure = true;
          console.warn(`Skipping skill file during index: ${absolutePath}`, error);
        }
      }

      if (!hadFailure) {
        const existing = await database.select<Array<{ slug: string }>>('SELECT slug FROM skills');
        await Promise.all(
          existing
            .filter((row) => !nextSlugs.has(row.slug))
            .map((row) => deleteSkillRow(row.slug)),
        );
      }

      return { skillsIndexed: indexed };
    },

    async getGitConfig(): Promise<SkillGitConfig | null> {
      const database = await getDatabase();
      const rows = await database.select<
        Array<{
          remote_url: string;
          branch: string;
          author_name: string | null;
          author_email: string | null;
        }>
      >('SELECT remote_url, branch, author_name, author_email FROM skill_git_config WHERE id = 1 LIMIT 1');

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        remoteUrl: row.remote_url,
        branch: row.branch,
        ...(row.author_name ? { authorName: row.author_name } : {}),
        ...(row.author_email ? { authorEmail: row.author_email } : {}),
      };
    },

    async setGitConfig(config: SkillGitConfig | null): Promise<void> {
      const database = await getDatabase();

      if (!config) {
        await database.execute('DELETE FROM skill_git_config WHERE id = 1');
        return;
      }

      await database.execute(
        `INSERT INTO skill_git_config (id, remote_url, branch, author_name, author_email, updated_at)
         VALUES (1, $1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET
           remote_url = excluded.remote_url,
           branch = excluded.branch,
           author_name = excluded.author_name,
           author_email = excluded.author_email,
           updated_at = excluded.updated_at`,
        [
          config.remoteUrl,
          config.branch,
          config.authorName ?? null,
          config.authorEmail ?? null,
          new Date().toISOString(),
        ],
      );
    },
  };
};
