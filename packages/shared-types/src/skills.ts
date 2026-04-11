export type SkillRequires = {
  integrations?: string[];
  skills?: string[];
};

export type SkillFrontmatter = {
  name: string;
  description: string;
  author: string;
  team?: string;
  tags: string[];
  version: string;
  requires?: SkillRequires;
};

export type Skill = {
  path: string;
  frontmatter: SkillFrontmatter;
  body: string;
};

export type InstalledSkill = Skill & {
  installedAt: string;
  enabled: boolean;
};

export type SkillStore = {
  list(): Promise<Skill[]>;
  get(name: string): Promise<Skill | null>;
  install(name: string): Promise<InstalledSkill>;
  uninstall(name: string): Promise<void>;
  listInstalled(): Promise<InstalledSkill[]>;
  watch(onChange: (skills: Skill[]) => void): () => void;
};

export type SenseiRecommendation = {
  skillName: string;
  rationale: string;
  score: number;
};

export type SenseiInput = {
  role?: string;
  connectedIntegrations: string[];
  recentEntityIds: string[];
};
