import { readDir } from '@tauri-apps/plugin-fs';
import { dump, load } from 'js-yaml';

type PathStyle = 'posix' | 'windows';

const POSIX_SEPARATOR_PATTERN = /\/+/u;
const WINDOWS_SEPARATOR_PATTERN = /[\\/]+/u;
const WINDOWS_DRIVE_ROOT_PATTERN = /^[A-Za-z]:[\\/]?$/u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:|[\\/]{2})/u;
const LEADING_POSIX_SEPARATOR_PATTERN = /^\//u;

const getPathStyle = (path: string): PathStyle => {
  return WINDOWS_ABSOLUTE_PATH_PATTERN.test(path) ? 'windows' : 'posix';
};

const getPathSeparator = (style: PathStyle): '/' | '\\' => {
  return style === 'windows' ? '\\' : '/';
};

const getPathSeparatorPattern = (style: PathStyle): RegExp => {
  return style === 'windows' ? WINDOWS_SEPARATOR_PATTERN : POSIX_SEPARATOR_PATTERN;
};

const standardizeAbsolutePath = (value: string, style: PathStyle): string => {
  if (value.length === 0) {
    throw new Error('Vault paths cannot be empty.');
  }

  if (style === 'posix') {
    return /^\/+$/u.test(value) ? '/' : value.replace(/\/+$/u, '');
  }

  const standardized = value.replace(/\//gu, '\\');

  if (WINDOWS_DRIVE_ROOT_PATTERN.test(standardized)) {
    return `${standardized.slice(0, 2)}\\`;
  }

  return standardized.replace(/\\+$/u, '');
};

const normalizeRoot = (root: string): string => {
  const style = getPathStyle(root);
  return standardizeAbsolutePath(root, style);
};

export const normalizeVaultRelativePath = (value: string, style: PathStyle = 'posix'): string => {
  if (value.length === 0) {
    return '';
  }

  if (
    (style === 'windows' && WINDOWS_ABSOLUTE_PATH_PATTERN.test(value)) ||
    (style === 'posix' && LEADING_POSIX_SEPARATOR_PATTERN.test(value))
  ) {
    throw new Error('Vault note paths must be relative to the vault root.');
  }

  const segments = value
    .split(getPathSeparatorPattern(style))
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.some((segment) => segment === '..')) {
    throw new Error('Vault note paths cannot escape the configured vault root.');
  }

  return segments.join('/');
};

const normalizeAbsoluteForComparison = (value: string, style: PathStyle): string => {
  const normalized = standardizeAbsolutePath(value, style);
  return style === 'windows' ? normalized.toLowerCase() : normalized;
};

const joinAbsolutePath = (root: string, child: string, style: PathStyle): string => {
  if (child.length === 0) {
    return root;
  }

  if ((style === 'posix' && root === '/') || (style === 'windows' && WINDOWS_DRIVE_ROOT_PATTERN.test(root))) {
    return `${root}${child}`;
  }

  return `${root}${getPathSeparator(style)}${child}`;
};

export const relativeVaultPath = (root: string, absolutePath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  const style = getPathStyle(normalizedRoot);
  const separator = getPathSeparator(style);
  const normalizedAbsolutePath = standardizeAbsolutePath(absolutePath, style);
  const comparableRoot = normalizeAbsoluteForComparison(normalizedRoot, style);
  const comparableAbsolutePath = normalizeAbsoluteForComparison(normalizedAbsolutePath, style);

  if (comparableAbsolutePath === comparableRoot) {
    return '';
  }

  const rootPrefix = normalizedRoot.endsWith(separator) ? normalizedRoot : `${normalizedRoot}${separator}`;
  const comparableRootPrefix = separator === '\\' ? rootPrefix.toLowerCase() : rootPrefix;

  if (!comparableAbsolutePath.startsWith(comparableRootPrefix)) {
    throw new Error(`Path "${absolutePath}" is outside vault root "${root}".`);
  }

  return normalizedAbsolutePath.slice(rootPrefix.length).split(getPathSeparatorPattern(style)).join('/');
};

export const resolveVaultPath = (root: string, relativePath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  const style = getPathStyle(normalizedRoot);
  const separator = getPathSeparator(style);
  const normalizedRelativePath = normalizeVaultRelativePath(relativePath, style);
  return joinAbsolutePath(normalizedRoot, normalizedRelativePath.replaceAll('/', separator), style);
};

export const walkVaultFiles = async (
  root: string,
  predicate?: (absolutePath: string) => boolean,
): Promise<string[]> => {
  const normalizedRoot = normalizeRoot(root);
  const style = getPathStyle(normalizedRoot);
  const stack = [normalizedRoot];
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

      const absolutePath = joinAbsolutePath(directory, entry.name, style);

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
