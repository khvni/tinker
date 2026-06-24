/**
 * Tests for URL scheme guard in IPC handlers.
 *
 * These test the `guardUrl` function that validates URLs before passing
 * them to `shell.openExternal`. Without this guard, a compromised renderer
 * could call `window.open('javascript:alert(1)')` and execute arbitrary
 * code in the main process.
 *
 * Per the Vitest root (vite.config.ts: `root: resolve(__dirname, 'src/renderer')`),
 * tests for main-process IPC handlers live here so they are discovered.
 */

// We need to import the guard function. Since guardUrl lives in src/main/main.ts
// and we're testing it from src/renderer, we import the function directly.
// TypeScript will resolve this correctly at test time.
import { guardUrl } from './security-guard.js';

describe('guardUrl', () => {
  // -------------------------------------------------------------------------
  // Valid URLs — must not throw
  // -------------------------------------------------------------------------

  it('accepts https: URLs', () => {
    expect(() => guardUrl('https://example.com')).not.toThrow();
    expect(() => guardUrl('https://github.com/khvni/tinker')).not.toThrow();
  });

  it('accepts http: URLs', () => {
    expect(() => guardUrl('http://localhost:5173/')).not.toThrow();
    expect(() => guardUrl('http://example.com/path?query=1')).not.toThrow();
  });

  it('accepts https: with port numbers', () => {
    expect(() => guardUrl('https://localhost:3000/')).not.toThrow();
    expect(() => guardUrl('https://example.com:8080/api')).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Invalid URLs — must throw
  // -------------------------------------------------------------------------

  it('rejects javascript: URLs', () => {
    expect(() => guardUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects javascript: URLs with encoded payload', () => {
    expect(() => guardUrl('javascript:eval(atob("YWxlcnQoMSk="))')).toThrow();
  });

  it('rejects data: URLs', () => {
    expect(() => guardUrl('data:text/html,<script>alert(1)</script>')).toThrow();
  });

  it('rejects vbscript: URLs', () => {
    expect(() => guardUrl('vbscript:msgbox("x")')).toThrow();
  });

  it('rejects file: URLs', () => {
    expect(() => guardUrl('file:///etc/passwd')).toThrow();
  });

  it('rejects mailto: URLs', () => {
    expect(() => guardUrl('mailto:test@example.com')).toThrow();
  });

  it('rejects empty string (invalid URL)', () => {
    // new URL('') throws before scheme check, so guardUrl re-throws with 'Invalid URL'
    expect(() => guardUrl('')).toThrow();
  });

  it('rejects completely invalid URL strings', () => {
    expect(() => guardUrl('not a url at all')).toThrow();
    expect(() => guardUrl('://missing-scheme')).toThrow();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('accepts URLs with common path characters', () => {
    expect(() => guardUrl('https://example.com/path/to/resource')).not.toThrow();
    expect(() => guardUrl('https://example.com/path?query=value&other=2')).not.toThrow();
    expect(() => guardUrl('https://example.com/path#anchor')).not.toThrow();
  });
});