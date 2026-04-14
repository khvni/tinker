import { exists, mkdir, readTextFile, stat, watch, writeTextFile } from '@tauri-apps/plugin-fs';
import type { VaultConfig, VaultNote, VaultService } from '@tinker/shared-types';
import { deriveNoteTitle, parseFrontmatter, resolveVaultPath, serializeFrontmatter, walkMarkdownFiles } from './vault-utils.js';

type StoredVaultState = {
  path: string;
  isNew: boolean;
};

const DEFAULT_WELCOME_BODY = ['# Welcome', '', 'Your vault is ready.'].join('\n');

const normalizeSuffixFilter = (glob?: string): string | null => {
  if (!glob) {
    return null;
  }

  const normalized = glob.trim().replace(/^\*+/u, '');
  return normalized.length > 0 ? normalized : null;
};

export const createVaultService = (): VaultService => {
  let state: StoredVaultState | null = null;

  const requireVaultPath = (): string => {
    if (!state) {
      throw new Error('VaultService.init must be called before using the vault service.');
    }

    return state.path;
  };

  return {
    async init(config: VaultConfig): Promise<void> {
      state = { ...config };

      if (!(await exists(config.path))) {
        await mkdir(config.path, { recursive: true });
      }

      const notePaths = await walkMarkdownFiles(config.path);
      if (notePaths.length > 0) {
        return;
      }

      await writeTextFile(
        resolveVaultPath(config.path, 'Welcome.md'),
        serializeFrontmatter({ title: 'Welcome to Tinker' }, DEFAULT_WELCOME_BODY),
      );
    },

    async readNote(relativePath: string): Promise<VaultNote | null> {
      const vaultPath = requireVaultPath();
      const absolutePath = resolveVaultPath(vaultPath, relativePath);

      if (!(await exists(absolutePath))) {
        return null;
      }

      const [text, info] = await Promise.all([readTextFile(absolutePath), stat(absolutePath)]);
      const { frontmatter, body } = parseFrontmatter(text);

      return {
        relativePath,
        title: deriveNoteTitle(relativePath, frontmatter, body),
        frontmatter,
        body,
        lastModified: info.mtime?.toISOString() ?? new Date().toISOString(),
      };
    },

    async writeNote(relativePath: string, frontmatter: Record<string, unknown>, body: string): Promise<void> {
      const vaultPath = requireVaultPath();
      await writeTextFile(resolveVaultPath(vaultPath, relativePath), serializeFrontmatter(frontmatter, body));
    },

    async listNotes(glob?: string): Promise<string[]> {
      const vaultPath = requireVaultPath();
      const suffix = normalizeSuffixFilter(glob);
      const markdownFiles = await walkMarkdownFiles(vaultPath);

      return markdownFiles
        .map((absolutePath) => absolutePath.slice(vaultPath.replace(/\/+$/u, '').length + 1))
        .filter((relativePath) => (suffix ? relativePath.endsWith(suffix) : true));
    },

    watch(onChange: (path: string) => void): () => void {
      const vaultPath = requireVaultPath();
      let unsubscribe: (() => void) | null = null;

      void watch(vaultPath, (event) => {
        for (const path of event.paths) {
          onChange(path);
        }
      }, { recursive: true }).then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
      });

      return () => {
        unsubscribe?.();
      };
    },
  };
};
