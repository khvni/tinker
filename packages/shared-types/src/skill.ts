import type { RoleProfile } from './coach.js';

export const SKILLS_VAULT_DIRECTORY = '.tinker/skills';
export const DEFAULT_SKILL_VERSION = '1.0.0';

export type SkillFrontmatter = {
  id: string;
  title: string;
  role?: string;
  tools?: string[];
  version?: string;
  author?: string;
  description?: string;
  tags?: string[];
  name?: string;
  [key: string]: unknown;
};

export type SkillDefinition = {
  id: string;
  title: string;
  role: string | null;
  tools: string[];
  version: string;
  author: string | null;
  body: string;
};

export type Skill = SkillDefinition & {
  // `slug` remains as a legacy alias while existing callers migrate to `id`.
  slug: string;
  description: string;
  tags: string[];
  relativePath: string;
  frontmatter: SkillFrontmatter;
  lastModified: string;
  active: boolean;
  installedAt: string;
};

export type SkillDraft = {
  slug: string;
  title?: string;
  role?: string;
  description: string;
  body: string;
  tools?: string[];
  tags?: string[];
  version?: string;
  author?: string;
};

export type SkillGitConfig = {
  remoteUrl: string;
  branch: string;
  authorName?: string;
  authorEmail?: string;
};

export type SkillSyncReport = {
  pulled: string[];
  pushed: string[];
  conflicts: string[];
  message: string;
};

export type SkillSearchResult = {
  skill: Skill;
  score: number;
};

export type SkillStore = {
  init(vaultPath: string): Promise<void>;
  list(): Promise<Skill[]>;
  get(slug: string): Promise<Skill | null>;
  search(query: string, limit?: number): Promise<SkillSearchResult[]>;
  getActive(): Promise<Skill[]>;
  getRoleProfile(connectedTools: ReadonlyArray<string>): Promise<RoleProfile>;
  setActive(slug: string, active: boolean): Promise<void>;
  installFromFile(sourceAbsolutePath: string): Promise<Skill>;
  installFromDraft(draft: SkillDraft): Promise<Skill>;
  uninstall(slug: string): Promise<void>;
  reindex(): Promise<{ skillsIndexed: number }>;
  getGitConfig(): Promise<SkillGitConfig | null>;
  setGitConfig(config: SkillGitConfig | null): Promise<void>;
};
