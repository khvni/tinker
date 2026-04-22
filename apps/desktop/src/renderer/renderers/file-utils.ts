export type FilePaneParams = {
  path: string;
  mime?: string;
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MIME_BY_EXTENSION: Record<string, string> = {
  '.csv': 'text/csv',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.xml': 'text/xml',
};
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
const CODE_LANGUAGE_BY_MIME: Record<string, string> = {
  'application/javascript': 'javascript',
  'application/json': 'json',
  'application/typescript': 'typescript',
  'application/xhtml+xml': 'html',
  'application/xml': 'xml',
  'text/html': 'html',
  'text/javascript': 'javascript',
  'text/markdown': 'markdown',
  'text/typescript': 'typescript',
  'text/x-markdown': 'markdown',
  'text/x-python': 'python',
  'text/x-rust': 'rust',
  'text/x-shellscript': 'bash',
  'text/xml': 'xml',
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

const normalizeMime = (mime: string): string => {
  return mime.split(';', 1)[0]?.trim().toLowerCase() ?? '';
};

export const getPanelTitleForPath = (path: string): string => {
  const segments = path.split(/[\\/]/u);
  return segments.at(-1) ?? path;
};

export const getFileMimeForPath = (path: string): string => {
  const extension = getFileExtension(path);
  if (extension === '.svg') {
    return 'image/svg+xml';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return getImageMimeType(path);
  }

  return MIME_BY_EXTENSION[extension] ?? 'text/plain';
};

export const getPanelIdForPath = (path: string, mime = getFileMimeForPath(path)): string => {
  return `file:${encodeURIComponent(mime)}:${path}`;
};

export const getFileTitleForPath = (path: string, mime = getFileMimeForPath(path)): string => {
  return mime === 'text/markdown; mode=edit' ? `${getPanelTitleForPath(path)} (Edit)` : getPanelTitleForPath(path);
};

export const getCodeLanguage = (path: string, mime?: string): string => {
  const normalizedMime = mime ? normalizeMime(mime) : '';

  if (normalizedMime && normalizedMime !== 'text/plain') {
    const mimeLanguage = CODE_LANGUAGE_BY_MIME[normalizedMime];
    if (mimeLanguage) {
      return mimeLanguage;
    }
  }

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
