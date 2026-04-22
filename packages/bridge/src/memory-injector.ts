import type { OpencodeClient } from '@opencode-ai/sdk/v2/client';
import { readDir, readTextFile, stat } from '@tauri-apps/plugin-fs';

const MAX_MEMORY_FILE_COUNT = 5;
const MAX_MEMORY_FILE_BYTES = 100 * 1024;

type MemoryInjectorLogger = (message: string) => void;

export type InjectMemoryContextOptions = {
  memoryDirectory: string;
  logger?: MemoryInjectorLogger;
};

type MemoryFile = {
  name: string;
  path: string;
  modifiedAt: number;
  text: string;
};

const defaultLogger: MemoryInjectorLogger = (message) => {
  console.warn(message);
};

const isMarkdownFileName = (name: string | undefined): name is string => {
  return typeof name === 'string' && name.toLowerCase().endsWith('.md');
};

const joinPath = (base: string, leaf: string): string => {
  if (base.endsWith('/')) {
    return `${base}${leaf}`;
  }
  if (base.endsWith('\\')) {
    return `${base}${leaf}`;
  }

  return base.includes('\\') && !base.includes('/') ? `${base}\\${leaf}` : `${base}/${leaf}`;
};

export const readRecentMemoryFiles = async (
  memoryDirectory: string,
  logger: MemoryInjectorLogger = defaultLogger,
): Promise<MemoryFile[]> => {
  const entries = await readDir(memoryDirectory);
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile && isMarkdownFileName(entry.name))
      .map(async (entry) => {
        const name = entry.name;
        if (!name) {
          return null;
        }

        try {
          const path = joinPath(memoryDirectory, name);
          const info = await stat(path);

          return {
            name,
            path,
            modifiedAt: info.mtime?.getTime() ?? 0,
            size: typeof info.size === 'number' ? info.size : 0,
          };
        } catch (error) {
          logger(`Skipping memory file metadata read for "${joinPath(memoryDirectory, name)}": ${String(error)}`);
          return null;
        }
      }),
  );

  const recentFiles: MemoryFile[] = [];
  const sortedCandidates = candidates
    .filter(
      (
        candidate,
      ): candidate is {
        name: string;
        path: string;
        modifiedAt: number;
        size: number;
      } => candidate !== null,
    )
    .sort((left, right) => right.modifiedAt - left.modifiedAt || left.name.localeCompare(right.name));

  for (const candidate of sortedCandidates) {
    if (recentFiles.length >= MAX_MEMORY_FILE_COUNT) {
      break;
    }

    if (candidate.size > MAX_MEMORY_FILE_BYTES) {
      logger(`Skipping memory file "${candidate.path}" because it exceeds 100KB.`);
      continue;
    }

    try {
      const text = await readTextFile(candidate.path);
      recentFiles.push({
        name: candidate.name,
        path: candidate.path,
        modifiedAt: candidate.modifiedAt,
        text,
      });
    } catch (error) {
      logger(`Skipping unreadable memory file "${candidate.path}": ${String(error)}`);
    }
  }

  return recentFiles;
};

export const buildMemoryContext = (files: readonly MemoryFile[]): string | null => {
  if (files.length === 0) {
    return null;
  }

  return [
    'Relevant local memory:',
    '',
    ...files.flatMap((file) => [`## ${file.name}`, file.text.trimEnd(), '']),
  ].join('\n').trimEnd();
};

export const injectMemoryContext = async (
  client: Pick<OpencodeClient, 'session'>,
  sessionID: string,
  options: InjectMemoryContextOptions,
): Promise<void> => {
  const text = buildMemoryContext(await readRecentMemoryFiles(options.memoryDirectory, options.logger));

  if (!text) {
    return;
  }

  await client.session.prompt({
    sessionID,
    noReply: true,
    parts: [{ type: 'text', text }],
  });
};
