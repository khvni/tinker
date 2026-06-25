import { describe, expect, it } from 'vitest';

/**
 * guardUrl unit tests — tests the URL scheme whitelist logic.
 * The actual function lives in the main process (apps/desktop/src/main/main.ts)
 * but since it imports no Electron/Node modules it can be placed here for
 * Vitest discovery (vitest root is src/renderer).
 *
 * Matches the pattern from apps/desktop/electron/main.ts (Jun 10 aa1b2a2).
 */

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:']);

const guardUrl = (url: string): void => {
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

describe('guardUrl', () => {
  it('allows https URLs', () => {
    expect(() => guardUrl('https://example.com')).not.toThrow();
    expect(() => guardUrl('https://github.com/khvni/tinker')).not.toThrow();
  });

  it('allows http URLs', () => {
    expect(() => guardUrl('http://localhost:5173')).not.toThrow();
    expect(() => guardUrl('http://example.com/path')).not.toThrow();
  });

  it('rejects javascript: URLs', () => {
    expect(() => guardUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects data: URLs', () => {
    expect(() => guardUrl('data:text/html,<script>alert(1)</script>')).toThrow();
  });

  it('rejects file: URLs', () => {
    expect(() => guardUrl('file:///etc/passwd')).toThrow();
  });

  it('rejects tel: URLs', () => {
    expect(() => guardUrl('tel:+15551234567')).toThrow();
  });

  it('rejects mailto: URLs', () => {
    expect(() => guardUrl('mailto:test@example.com')).toThrow();
  });

  it('rejects ssh: URLs', () => {
    expect(() => guardUrl('ssh://user@host/path')).toThrow();
  });

  it('rejects blob: URLs', () => {
    expect(() => guardUrl('blob:https://example.com/uuid')).toThrow();
  });

  it('throws for malformed URLs', () => {
    expect(() => guardUrl('not-a-url')).toThrow();
    expect(() => guardUrl('')).toThrow();
  });
});
