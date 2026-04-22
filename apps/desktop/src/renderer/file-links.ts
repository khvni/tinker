import { resolveVaultPath } from '@tinker/memory';
import { isAbsolutePath } from './renderers/file-utils.js';

const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const FILE_PROTOCOL = 'file:';
const WINDOWS_FILE_URL_PATH_PATTERN = /^\/[A-Za-z]:[\\/]/u;

type ChatLinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'file'; path: string }
  | { kind: 'invalid' };

const decodePath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const fromFileUrl = (href: string): string | null => {
  try {
    const url = new URL(href);
    if (url.protocol !== FILE_PROTOCOL) {
      return null;
    }

    const hostPrefix = url.host.length > 0 ? `//${url.host}` : '';
    const pathname = decodePath(url.pathname);
    const normalizedPath = WINDOWS_FILE_URL_PATH_PATTERN.test(pathname)
      ? pathname.slice(1)
      : pathname;

    return `${hostPrefix}${normalizedPath}`;
  } catch {
    return null;
  }
};

const readProtocol = (href: string): string | null => {
  try {
    return new URL(href).protocol;
  } catch {
    const match = href.match(/^([A-Za-z][A-Za-z\d+.-]*:)/u);
    return match?.[1]?.toLowerCase() ?? null;
  }
};

export const getChatLinkTarget = (href: string | null | undefined): ChatLinkTarget => {
  if (!href) {
    return { kind: 'invalid' };
  }

  const decodedHref = decodePath(href);
  if (isAbsolutePath(decodedHref)) {
    return { kind: 'file', path: decodedHref };
  }

  if (href.startsWith('#')) {
    return { kind: 'invalid' };
  }

  if (href.startsWith('file://')) {
    const path = fromFileUrl(href);
    return path ? { kind: 'file', path } : { kind: 'invalid' };
  }

  const protocol = readProtocol(href);
  if (protocol) {
    if (SAFE_EXTERNAL_PROTOCOLS.has(protocol)) {
      return { kind: 'external', href };
    }

    return { kind: 'invalid' };
  }

  return { kind: 'file', path: decodedHref };
};

export const resolveWorkspaceFilePath = (
  reportedPath: string,
  sessionFolderPath: string | null,
): string | null => {
  if (reportedPath.length === 0) {
    return null;
  }

  if (isAbsolutePath(reportedPath)) {
    return reportedPath;
  }

  if (!sessionFolderPath) {
    return null;
  }

  try {
    return resolveVaultPath(sessionFolderPath, reportedPath);
  } catch {
    return null;
  }
};
