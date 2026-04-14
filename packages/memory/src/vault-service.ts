import { exists, mkdir, readDir, readTextFile, stat, watch, writeTextFile } from '@tauri-apps/plugin-fs';
import type { VaultConfig, VaultNote, VaultService } from '@tinker/shared-types';
import {
  deriveNoteTitle,
  parseFrontmatter,
  relativeVaultPath,
  resolveVaultPath,
  serializeFrontmatter,
  walkMarkdownFiles,
} from './vault-utils.js';

type StoredVaultState = {
  path: string;
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
      state = { path: config.path };

      const existed = await exists(config.path);
      if (!existed) {
        await mkdir(config.path, { recursive: true });
      }

      const entries = await readDir(config.path);
      if (entries.length > 0) {
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
      const lastSlash = relativePath.lastIndexOf('/');
      if (lastSlash > 0) {
        await mkdir(resolveVaultPath(vaultPath, relativePath.slice(0, lastSlash)), { recursive: true });
      }
      await writeTextFile(resolveVaultPath(vaultPath, relativePath), serializeFrontmatter(frontmatter, body));
    },

    async listNotes(glob?: string): Promise<string[]> {
      const vaultPath = requireVaultPath();
      const suffix = normalizeSuffixFilter(glob);
      const markdownFiles = await walkMarkdownFiles(vaultPath);

      return markdownFiles
        .map((absolutePath) => relativeVaultPath(vaultPath, absolutePath))
        .filter((relativePath) => (suffix ? relativePath.endsWith(suffix) : true));
    },

    watch(onChange: (path: string) => void): () => void {
      const vaultPath = requireVaultPath();
      let cancelled = false;

      const pendingUnwatch = watch(
        vaultPath,
        (event) => {
          for (const path of event.paths) {
            onChange(path);
          }
        },
        { recursive: true },
      )
        .then((unsubscribe) => {
          if (cancelled) {
            unsubscribe();
          }

          return unsubscribe;
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn('Vault watch registration failed.', error);
          }
          return () => undefined;
        });

      return () => {
        cancelled = true;
        void pendingUnwatch.then((unsubscribe) => {
          unsubscribe();
        });
      };
    },
  };
};
