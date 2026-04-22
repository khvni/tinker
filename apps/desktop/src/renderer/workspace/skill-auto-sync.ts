import { isGitAvailable, syncSkills } from '@tinker/memory';
import type { SkillGitConfig, SkillStore } from '@tinker/shared-types';

/**
 * Dependencies for `runSkillAutoSync`. `skillStore` only needs `getGitConfig`
 * and the two helpers default to the production implementations so production
 * callers pass just the store + root path; tests swap the helpers in.
 */
export type SkillAutoSyncDeps = {
  readonly skillStore: Pick<SkillStore, 'getGitConfig'>;
  readonly skillsRootPath: string | null;
  readonly isGitAvailable?: () => Promise<boolean>;
  readonly syncSkills?: (rootPath: string, config: SkillGitConfig) => Promise<unknown>;
};

/**
 * Best-effort push/pull of the skill vault to the configured git remote.
 *
 * Silently no-ops when:
 * - git isn't installed on the host
 * - no git config was saved via the Playbook settings modal
 * - the skill store hasn't picked a per-user root path yet
 *
 * Any runtime error (network, merge conflict, etc.) is rethrown so the caller
 * can surface a toast in its own flow. Callers who don't care about errors can
 * wrap the call in their own try/catch.
 */
export const runSkillAutoSync = async (deps: SkillAutoSyncDeps): Promise<void> => {
  const gitAvailable = deps.isGitAvailable ?? isGitAvailable;
  const runSync = deps.syncSkills ?? syncSkills;

  if (!(await gitAvailable())) {
    return;
  }

  const config = await deps.skillStore.getGitConfig();
  if (!config) {
    return;
  }

  if (!deps.skillsRootPath) {
    return;
  }

  await runSync(deps.skillsRootPath, config);
};
