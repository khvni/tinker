import type { Skill } from '@tinker/shared-types';
import type { SegmentedControlOption } from '@tinker/design';

export type PlaybookRoleFilter = string;

/**
 * Case-insensitive substring match across title, description, role, and tags.
 * A blank / whitespace-only filter matches everything so callers don't have to
 * branch before invoking.
 */
export const matchesPlaybookFilter = (skill: Skill, filter: string): boolean => {
  const needle = filter.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }

  if (skill.title.toLowerCase().includes(needle)) {
    return true;
  }

  if (skill.description.toLowerCase().includes(needle)) {
    return true;
  }

  if (skill.role && skill.role.toLowerCase().includes(needle)) {
    return true;
  }

  return skill.tags.some((tag) => tag.toLowerCase().includes(needle));
};

/**
 * Builds the role segmented-control options. Returns an empty array when <2
 * distinct roles exist so the segmented control stays hidden in the UI.
 */
export const derivePlaybookRoleOptions = (
  skills: ReadonlyArray<Skill>,
): ReadonlyArray<SegmentedControlOption<PlaybookRoleFilter>> => {
  const roles = new Set<string>();
  for (const skill of skills) {
    if (skill.role) {
      roles.add(skill.role);
    }
  }

  if (roles.size < 2) {
    return [];
  }

  const sorted = [...roles].sort((left, right) => left.localeCompare(right));
  return [
    { value: '', label: 'All' },
    ...sorted.map((role) => ({ value: role, label: role })),
  ];
};
