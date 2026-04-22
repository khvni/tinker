export const SKILLS_VAULT_DIRECTORY = '.tinker/skills';

export type SkillAuthor = {
  name: string;
  email?: string;
  url?: string;
};

export type SkillRole = 'assistant' | 'system' | 'tool' | 'user' | (string & {});

export type SkillSpecFrontmatter = {
  id: string;
  title: string;
  role: SkillRole;
  tools?: string[];
  version: string;
  author?: SkillAuthor;
  [key: string]: unknown;
};

export type SkillSpec = SkillSpecFrontmatter & {
  body: string;
};

export type SkillFrontmatter = {
  name: string;
  description: string;
  tools?: string[];
  tags?: string[];
  id?: SkillSpecFrontmatter['id'];
  title?: SkillSpecFrontmatter['title'];
  role?: SkillSpecFrontmatter['role'];
  version?: SkillSpecFrontmatter['version'];
  author?: SkillSpecFrontmatter['author'];
  [key: string]: unknown;
};

export type Skill = {
  slug: string;
  title: string;
  description: string;
  tools: string[];
  tags: string[];
  body: string;
  relativePath: string;
  frontmatter: SkillFrontmatter;
  lastModified: string;
  active: boolean;
  installedAt: string;
};

export type SkillDraft = {
  slug: string;
  description: string;
  body: string;
  tools?: string[];
  tags?: string[];
  title?: SkillSpecFrontmatter['title'];
  role?: SkillSpecFrontmatter['role'];
  version?: SkillSpecFrontmatter['version'];
  author?: SkillSpecFrontmatter['author'];
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
  setActive(slug: string, active: boolean): Promise<void>;
  installFromFile(sourceAbsolutePath: string): Promise<Skill>;
  installFromDraft(draft: SkillDraft): Promise<Skill>;
  uninstall(slug: string): Promise<void>;
  reindex(): Promise<{ skillsIndexed: number }>;
  getGitConfig(): Promise<SkillGitConfig | null>;
  setGitConfig(config: SkillGitConfig | null): Promise<void>;
};
