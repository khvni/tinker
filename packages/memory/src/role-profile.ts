import type { RoleProfile, Skill } from '@tinker/shared-types';

type RoleSignal = Exclude<RoleProfile['roleLabel'], 'generalist'>;
type RoleProfileSkill = Pick<Skill, 'active' | 'installedAt' | 'slug' | 'tags' | 'tools'>;

const ROLE_TOOL_MAP: Record<RoleSignal, readonly string[]> = {
  cx: ['intercom', 'zendesk'],
  engineering: ['github', 'gitlab', 'jira', 'linear'],
  finance: ['brex', 'netsuite', 'quickbooks', 'stripe'],
  marketing: ['ga4', 'google-ads', 'hubspot'],
  operations: ['airtable', 'notion'],
  sales: ['gong', 'hubspot', 'salesforce'],
};

const ROLE_TAG_ALIASES: Record<string, RoleSignal> = {
  'account-executive': 'sales',
  'account-manager': 'sales',
  bizops: 'operations',
  coding: 'engineering',
  cs: 'cx',
  'customer-success': 'cx',
  'customer-support': 'cx',
  cx: 'cx',
  developer: 'engineering',
  devrel: 'marketing',
  engineering: 'engineering',
  finance: 'finance',
  finops: 'finance',
  growth: 'marketing',
  marketing: 'marketing',
  operations: 'operations',
  ops: 'operations',
  revops: 'operations',
  sales: 'sales',
  seller: 'sales',
  support: 'cx',
};

const normalizeKey = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/gu, '-');
};

const normalizeConnectedTools = (connectedTools: ReadonlyArray<string>): string[] => {
  return Array.from(new Set(connectedTools.map(normalizeKey).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
};

const sortFrequentedSkills = (skills: ReadonlyArray<RoleProfileSkill>): string[] => {
  // Usage telemetry does not exist yet, so "frequented" is approximated from active skills first,
  // then by the freshest install timestamps.
  return [...skills]
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      const leftInstalledAt = Date.parse(left.installedAt);
      const rightInstalledAt = Date.parse(right.installedAt);
      const leftTime = Number.isNaN(leftInstalledAt) ? 0 : leftInstalledAt;
      const rightTime = Number.isNaN(rightInstalledAt) ? 0 : rightInstalledAt;

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.slug.localeCompare(right.slug);
    })
    .map((skill) => skill.slug)
    .filter((slug, index, values) => values.indexOf(slug) === index);
};

const scoreRoles = (connectedTools: ReadonlyArray<string>, skills: ReadonlyArray<RoleProfileSkill>): Map<RoleSignal, number> => {
  const scores = new Map<RoleSignal, number>();

  const bump = (role: RoleSignal, amount: number): void => {
    scores.set(role, (scores.get(role) ?? 0) + amount);
  };

  for (const tool of connectedTools) {
    for (const [role, mappedTools] of Object.entries(ROLE_TOOL_MAP) as Array<[RoleSignal, readonly string[]]>) {
      if (mappedTools.includes(tool)) {
        bump(role, 3);
      }
    }
  }

  for (const skill of skills) {
    const skillWeight = skill.active ? 3 : 2;

    for (const tag of skill.tags) {
      const role = ROLE_TAG_ALIASES[normalizeKey(tag)];
      if (role) {
        bump(role, skillWeight);
      }
    }

    for (const tool of skill.tools.map(normalizeKey).filter(Boolean)) {
      for (const [role, mappedTools] of Object.entries(ROLE_TOOL_MAP) as Array<[RoleSignal, readonly string[]]>) {
        if (mappedTools.includes(tool)) {
          bump(role, skill.active ? 2 : 1);
        }
      }
    }
  }

  return scores;
};

const inferRoleLabel = (connectedTools: ReadonlyArray<string>, skills: ReadonlyArray<RoleProfileSkill>): string => {
  const scores = scoreRoles(connectedTools, skills);
  let bestRole: RoleSignal | null = null;
  let bestScore = 0;

  for (const [role, score] of scores.entries()) {
    if (score > bestScore || (score === bestScore && bestRole && role.localeCompare(bestRole) < 0)) {
      bestRole = role;
      bestScore = score;
    }
  }

  return bestRole ?? 'generalist';
};

export const inferRoleProfile = ({
  connectedTools,
  skills,
}: {
  connectedTools: ReadonlyArray<string>;
  skills: ReadonlyArray<RoleProfileSkill>;
}): RoleProfile => {
  const normalizedTools = normalizeConnectedTools(connectedTools);

  return {
    roleLabel: inferRoleLabel(normalizedTools, skills),
    connectedTools: normalizedTools,
    frequentedSkills: sortFrequentedSkills(skills),
  };
};
