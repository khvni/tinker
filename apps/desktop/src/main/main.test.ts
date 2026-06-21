/**
 * Unit tests for main.ts IPC handlers.
 * These test the pure-logic helpers (guardUrl) in isolation.
 */

import { describe, expect, it } from 'vitest';

// ── guardUrl helper ────────────────────────────────────────────────────────────
// Extracted from registerIpcHandlers for unit testing.
// Keep in sync with the source of truth in main.ts.

const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);

const guardUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Disallowed URL protocol: ${parsed.protocol}`);
  }
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('guardUrl', () => {
  it('allows https URLs', () => {
    expect(() => guardUrl('https://example.com')).not.toThrow();
    expect(() => guardUrl('https://example.com/path?query=1#hash')).not.toThrow();
  });

  it('allows http URLs', () => {
    expect(() => guardUrl('http://example.com')).not.toThrow();
  });

  it('allows mailto URLs', () => {
    expect(() => guardUrl('mailto:user@example.com')).not.toThrow();
    expect(() => guardUrl('mailto:user@example.com?subject=Hi')).not.toThrow();
  });

  it('allows tel URLs', () => {
    expect(() => guardUrl('tel:+1-555-123-4567')).not.toThrow();
  });

  it('rejects javascript: URLs', () => {
    expect(() => guardUrl('javascript:alert(1)')).toThrow('Disallowed URL protocol: javascript:');
  });

  it('rejects data: URLs', () => {
    expect(() => guardUrl('data:text/html,<script>alert(1)</script>')).toThrow(
      'Disallowed URL protocol: data:',
    );
  });

  it('rejects file: URLs', () => {
    expect(() => guardUrl('file:///etc/passwd')).toThrow('Disallowed URL protocol: file:');
  });

  it('rejects vbscript: URLs', () => {
    expect(() => guardUrl('vbscript:msgbox("x")')).toThrow('Disallowed URL protocol: vbscript:');
  });

  it('rejects blob: URLs', () => {
    expect(() => guardUrl('blob:https://example.com/c0ffeec0-cafe')).toThrow(
      'Disallowed URL protocol: blob:',
    );
  });

  it('throws on unparseable strings', () => {
    expect(() => guardUrl('not a url at all')).toThrow('Invalid URL');
    expect(() => guardUrl('')).toThrow('Invalid URL');
  });

  it('rejects URLs with unknown or empty protocols', () => {
    expect(() => guardUrl('ftp://example.com')).toThrow('Disallowed URL protocol: ftp:');
    expect(() => guardUrl('ssh://user@host/')).toThrow('Disallowed URL protocol: ssh:');
  });
});
