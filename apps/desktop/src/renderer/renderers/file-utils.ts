import type { PaneKind } from '@tinker/shared-types';

export type FilePaneParams = {
  path: string;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const CODE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.c': 'c',
  '.cpp': 'cpp',
  '.css': 'css',
  '.go': 'go',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'jsx',
  '.md': 'markdown',
  '.mjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.sh': 'bash',
  '.sql': 'sql',
  '.svg': 'xml',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.txt': 'plaintext',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

const POSIX_ABSOLUTE_PATH_PATTERN = /^\//u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|[\\/]{2})/u;

export const isAbsolutePath = (path: string): boolean => {
  return POSIX_ABSOLUTE_PATH_PATTERN.test(path) || WINDOWS_ABSOLUTE_PATH_PATTERN.test(path);
};

export const getFileExtension = (path: string): string => {
  const match = path.toLowerCase().match(/(\.[^./]+)$/u);
  return match?.[1] ?? '';
};

export const getPanelTitleForPath = (path: string): string => {
  const segments = path.split(/[\\/]/u);
  return segments.at(-1) ?? path;
};

export const getPanelIdForPath = (component: PaneKind, path: string): string => {
  return `${component}:${path}`;
};

export const getPaneKindForPath = (path: string): PaneKind => {
  const extension = getFileExtension(path);

  if (extension === '.md') {
    return 'markdown';
  }

  if (extension === '.csv') {
    return 'csv';
  }

  if (extension === '.html' || extension === '.htm') {
    return 'html';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  return 'code';
};

export const getCodeLanguage = (path: string): string => {
  return CODE_LANGUAGE_BY_EXTENSION[getFileExtension(path)] ?? 'plaintext';
};

export const getImageMimeType = (path: string): string => {
  const extension = getFileExtension(path);
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
};
