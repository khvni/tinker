/**
 * URL scheme guard for IPC handlers that call shell.openExternal.
 *
 * SECURITY: Without this guard, a compromised renderer could call
 * `window.open('javascript:alert(1)')` and execute arbitrary code in
 * the main process via shell.openExternal.
 *
 * Only http: and https: schemes are allowed. All others (javascript:,
 * data:, vbscript:, file:, mailto:, etc.) are blocked.
 */

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:']);

export const guardUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
    throw new Error(`URL scheme "${parsed.protocol}" not allowed`);
  }
};