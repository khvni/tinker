import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import type { SkillGitConfig, SkillSyncReport } from '@tinker/shared-types';
import { SKILLS_VAULT_DIRECTORY } from '@tinker/shared-types';
import { resolveVaultPath } from './vault-utils.js';

const DEFAULT_AUTHOR_NAME = 'Tinker';
const DEFAULT_AUTHOR_EMAIL = 'tinker@local';

type GitResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const runGit = async (args: string[], cwd: string): Promise<GitResult> => {
  const command = Command.create('git', args, { cwd });
  const output = await command.execute();
  return {
    code: output.code,
    stdout: output.stdout.trim(),
    stderr: output.stderr.trim(),
  };
};

const runGitChecked = async (args: string[], cwd: string): Promise<GitResult> => {
  const result = await runGit(args, cwd);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed (exit ${result.code}): ${result.stderr || result.stdout}`);
  }
  return result;
};

const parseUnmergedPaths = (statusOutput: string): string[] => {
  const conflicts: string[] = [];
  for (const line of statusOutput.split('\n')) {
    if (line.length < 3) {
      continue;
    }
    const code = line.slice(0, 2);
    if (code === 'UU' || code === 'AA' || code === 'DU' || code === 'UD' || code === 'AU' || code === 'UA' || code === 'DD') {
      conflicts.push(line.slice(3).trim());
    }
  }
  return conflicts;
};

const diffNames = async (from: string, to: string, cwd: string): Promise<string[]> => {
  const result = await runGit(['diff', '--name-only', from, to], cwd);
  if (result.code !== 0) {
    return [];
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
};

const revParse = async (ref: string, cwd: string): Promise<string | null> => {
  const result = await runGit(['rev-parse', '--verify', ref], cwd);
  return result.code === 0 ? result.stdout : null;
};

const ensureWorkingDirectory = async (vaultPath: string): Promise<string> => {
  const cwd = resolveVaultPath(vaultPath, '.tinker');
  if (!(await exists(cwd))) {
    await mkdir(cwd, { recursive: true });
  }
  const skillsDir = resolveVaultPath(vaultPath, SKILLS_VAULT_DIRECTORY);
  if (!(await exists(skillsDir))) {
    await mkdir(skillsDir, { recursive: true });
  }
  return cwd;
};

const ensureRepo = async (cwd: string, config: SkillGitConfig, vaultPath: string): Promise<void> => {
  const gitDir = resolveVaultPath(vaultPath, '.tinker/.git');

  if (!(await exists(gitDir))) {
    const init = await runGit(['init', '--initial-branch', config.branch], cwd);
    if (init.code !== 0) {
      // Older git (<2.28) does not support --initial-branch; fall back.
      await runGitChecked(['init'], cwd);
      await runGit(['symbolic-ref', 'HEAD', `refs/heads/${config.branch}`], cwd);
    }
  }

  await runGitChecked(['config', 'user.name', config.authorName ?? DEFAULT_AUTHOR_NAME], cwd);
  await runGitChecked(['config', 'user.email', config.authorEmail ?? DEFAULT_AUTHOR_EMAIL], cwd);

  const remoteList = await runGit(['remote'], cwd);
  const hasOrigin = remoteList.stdout.split('\n').some((line) => line.trim() === 'origin');
  if (!hasOrigin) {
    await runGitChecked(['remote', 'add', 'origin', config.remoteUrl], cwd);
  } else {
    await runGitChecked(['remote', 'set-url', 'origin', config.remoteUrl], cwd);
  }
};

const commitLocalChanges = async (cwd: string): Promise<boolean> => {
  await runGitChecked(['add', '--all', '--', 'skills'], cwd);
  const status = await runGit(['status', '--porcelain'], cwd);
  if (status.stdout.length === 0) {
    return false;
  }
  await runGitChecked(['commit', '-m', 'tinker: sync skills'], cwd);
  return true;
};

export const isGitAvailable = async (): Promise<boolean> => {
  try {
    const result = await runGit(['--version'], '.');
    return result.code === 0;
  } catch {
    return false;
  }
};

export const syncSkills = async (vaultPath: string, config: SkillGitConfig): Promise<SkillSyncReport> => {
  const cwd = await ensureWorkingDirectory(vaultPath);
  await ensureRepo(cwd, config, vaultPath);

  const fetch = await runGit(['fetch', 'origin', config.branch], cwd);
  const remoteExists = fetch.code === 0;
  const remoteRef = `origin/${config.branch}`;
  const remoteShaInitial = remoteExists ? await revParse(remoteRef, cwd) : null;
  const localShaInitial = await revParse('HEAD', cwd);

  const committed = await commitLocalChanges(cwd);

  if (!localShaInitial && !committed) {
    if (remoteShaInitial) {
      await runGitChecked(['checkout', '-B', config.branch, remoteRef], cwd);
    } else {
      return {
        pulled: [],
        pushed: [],
        conflicts: [],
        message: 'No local or remote commits yet. Add a skill and sync again.',
      };
    }
  } else if (!localShaInitial && committed) {
    await runGitChecked(['checkout', '-B', config.branch], cwd);
  }

  const branchCheck = await runGit(['symbolic-ref', '--short', 'HEAD'], cwd);
  if (branchCheck.code === 0 && branchCheck.stdout !== config.branch) {
    await runGitChecked(['checkout', '-B', config.branch], cwd);
  }

  const pulled: string[] = [];
  if (remoteShaInitial) {
    const preMergeSha = (await revParse('HEAD', cwd)) ?? '';
    const merge = await runGit(['merge', '--no-edit', remoteRef], cwd);

    if (merge.code !== 0) {
      const status = await runGit(['status', '--porcelain'], cwd);
      const conflicts = parseUnmergedPaths(status.stdout);
      await runGit(['merge', '--abort'], cwd);
      return {
        pulled: [],
        pushed: [],
        conflicts,
        message:
          conflicts.length > 0
            ? `Merge aborted. Resolve conflicts manually before retrying: ${conflicts.join(', ')}`
            : `Merge failed: ${merge.stderr || merge.stdout}`,
      };
    }

    const postMergeSha = (await revParse('HEAD', cwd)) ?? '';
    if (preMergeSha.length > 0 && postMergeSha.length > 0 && preMergeSha !== postMergeSha) {
      pulled.push(...(await diffNames(preMergeSha, postMergeSha, cwd)));
    }
  }

  const localAfterMerge = (await revParse('HEAD', cwd)) ?? '';
  const remoteAfterMerge = remoteShaInitial ? ((await revParse(remoteRef, cwd)) ?? remoteShaInitial) : null;

  const pushed: string[] = [];

  if (localAfterMerge.length > 0 && (!remoteAfterMerge || localAfterMerge !== remoteAfterMerge)) {
    const push = await runGit(['push', '--set-upstream', 'origin', config.branch], cwd);
    if (push.code !== 0) {
      return {
        pulled,
        pushed: [],
        conflicts: [],
        message: `Push failed: ${push.stderr || push.stdout}`,
      };
    }

    if (remoteAfterMerge) {
      pushed.push(...(await diffNames(remoteAfterMerge, localAfterMerge, cwd)));
    } else {
      const listing = await runGit(['ls-tree', '-r', '--name-only', config.branch], cwd);
      if (listing.code === 0) {
        pushed.push(
          ...listing.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('skills/') && line.toLowerCase().endsWith('.md')),
        );
      }
    }
  }

  const summaryParts: string[] = [];
  if (pulled.length > 0) {
    summaryParts.push(`pulled ${pulled.length}`);
  }
  if (pushed.length > 0) {
    summaryParts.push(`pushed ${pushed.length}`);
  }
  if (summaryParts.length === 0) {
    summaryParts.push('already up to date');
  }

  return {
    pulled,
    pushed,
    conflicts: [],
    message: summaryParts.join(', '),
  };
};
