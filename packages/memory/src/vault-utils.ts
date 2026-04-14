import { readDir } from '@tauri-apps/plugin-fs';
import { dump, load } from 'js-yaml';

const normalizeRoot = (root: string): string => root.replace(/\/+$/u, '');

const toAbsolutePath = (directory: string, name: string): string => {
  const normalizedDirectory = normalizeRoot(directory);
  return normalizedDirectory.length > 0 ? `${normalizedDirectory}/${name}` : name;
};

export const relativeVaultPath = (root: string, absolutePath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  return absolutePath.startsWith(`${normalizedRoot}/`) ? absolutePath.slice(normalizedRoot.length + 1) : absolutePath;
};

export const resolveVaultPath = (root: string, relativePath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  const normalizedRelativePath = relativePath.replace(/^\/+/u, '');
  return normalizedRelativePath.length > 0 ? `${normalizedRoot}/${normalizedRelativePath}` : normalizedRoot;
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
  if (!text.startsWith('---\n')) {
    return { frontmatter: {}, body: text };
  }

  const boundary = text.indexOf('\n---\n', 4);
  if (boundary < 0) {
    return { frontmatter: {}, body: text };
  }

  const rawFrontmatter = text.slice(4, boundary);
  const body = text.slice(boundary + 5);
  const parsed = load(rawFrontmatter);

  return {
    frontmatter: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {},
    body,
  };
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

  return `---\n${serialized}\n---\n\n${body.replace(/^\n+/u, '')}`;
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
