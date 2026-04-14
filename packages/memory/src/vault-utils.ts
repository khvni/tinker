import { readDir } from '@tauri-apps/plugin-fs';
import { dump, load } from 'js-yaml';

const PATH_SEPARATOR_PATTERN = /[\\/]+/u;
const TRAILING_SEPARATOR_PATTERN = /[\\/]+$/u;
const LEADING_SEPARATOR_PATTERN = /^[\\/]+/u;

const getPathSeparator = (path: string): '/' | '\\' => {
  return path.includes('\\') ? '\\' : '/';
};

const normalizeRoot = (root: string): string => root.replace(TRAILING_SEPARATOR_PATTERN, '');

const normalizeRelativePath = (value: string): string => {
  return value
    .replace(LEADING_SEPARATOR_PATTERN, '')
    .split(PATH_SEPARATOR_PATTERN)
    .filter((segment) => segment.length > 0)
    .join('/');
};

const toAbsolutePath = (directory: string, name: string): string => {
  const separator = getPathSeparator(directory);
  const normalizedDirectory = normalizeRoot(directory);
  return normalizedDirectory.length > 0 ? `${normalizedDirectory}${separator}${name}` : name;
};

export const relativeVaultPath = (root: string, absolutePath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  const normalizedRootPath = normalizedRoot.split(PATH_SEPARATOR_PATTERN).join('/');
  const normalizedAbsolutePath = absolutePath.split(PATH_SEPARATOR_PATTERN).join('/');

  if (normalizedAbsolutePath === normalizedRootPath) {
    return '';
  }

  const rootPrefix = `${normalizedRootPath}/`;
  return normalizedAbsolutePath.startsWith(rootPrefix)
    ? normalizedAbsolutePath.slice(rootPrefix.length)
    : normalizeRelativePath(absolutePath);
};

export const resolveVaultPath = (root: string, relativePath: string): string => {
  const separator = getPathSeparator(root);
  const normalizedRoot = normalizeRoot(root);
  const normalizedRelativePath = normalizeRelativePath(relativePath).replaceAll('/', separator);
  return normalizedRelativePath.length > 0 ? `${normalizedRoot}${separator}${normalizedRelativePath}` : normalizedRoot;
};

export const walkVaultFiles = async (
  root: string,
  predicate?: (absolutePath: string) => boolean,
): Promise<string[]> => {
  const stack = [normalizeRoot(root)];
  const files: string[] = [];

  while (stack.length > 0) {
    const directory = stack.pop();
    if (!directory) {
      continue;
    }

    const entries = await readDir(directory);

    for (const entry of entries) {
      if (entry.isSymlink) {
        continue;
      }

      const absolutePath = toAbsolutePath(directory, entry.name);

      if (entry.isDirectory) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile && (!predicate || predicate(absolutePath))) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

export const walkMarkdownFiles = async (root: string): Promise<string[]> => {
  return walkVaultFiles(root, (absolutePath) => absolutePath.toLowerCase().endsWith('.md'));
};

export const parseFrontmatter = (text: string): { frontmatter: Record<string, unknown>; body: string } => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);

  if (!match) {
    return { frontmatter: {}, body: text };
  }

  const [, rawFrontmatter = '', body = ''] = match;

  try {
    const parsed = load(rawFrontmatter);
    return {
      frontmatter: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {},
      body,
    };
  } catch {
    return { frontmatter: {}, body: text };
  }
};

export const serializeFrontmatter = (frontmatter: Record<string, unknown>, body: string): string => {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) {
    return body;
  }

  const serialized = dump(frontmatter, {
    flowLevel: -1,
    lineWidth: 120,
    noRefs: true,
    sortKeys: true,
  }).trimEnd();

  return body.length > 0 ? `---\n${serialized}\n---\n${body}` : `---\n${serialized}\n---\n`;
};

export const deriveNoteTitle = (relativePath: string, frontmatter: Record<string, unknown>, body: string): string => {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim().length > 0) {
    return frontmatter.title.trim();
  }

  const headingMatch = body.match(/^#\s+(.+)$/mu);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  return relativePath.replace(/\.md$/iu, '');
};
