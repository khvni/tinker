import { describe, expect, it } from 'vitest';

/** Schemes permitted for tinker:openExternal. */
const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

const guardUrl = (url: string): string => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!ALLOWED_URL_SCHEMES.has(protocol)) {
    throw new Error(`Refusing to open URL with disallowed scheme: ${protocol}`);
  }
  return url;
};

describe('guardUrl', () => {
  it('allows https URLs', () => {
    expect(guardUrl('https://github.com/khvni/tinker')).toBe('https://github.com/khvni/tinker');
  });

  it('allows http URLs', () => {
    expect(guardUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('allows mailto URLs', () => {
    expect(guardUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
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

  it('rejects vbscript: URLs', () => {
    expect(() => guardUrl('vbscript:msgbox("x")')).toThrow();
  });

  it('throws on invalid URL', () => {
    expect(() => guardUrl('not-a-url')).toThrow('Invalid URL: not-a-url');
  });
});
