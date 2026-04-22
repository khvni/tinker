import { describe, expect, it } from 'vitest';
import { getCodeLanguage } from './file-utils.js';

describe('getCodeLanguage', () => {
  it('falls back to the file extension when mime is generic text/plain', () => {
    expect(getCodeLanguage('/tmp/example.ts', 'text/plain')).toBe('typescript');
  });

  it('prefers a specific mime when available', () => {
    expect(getCodeLanguage('/tmp/example.txt', 'application/json')).toBe('json');
  });

  it('defaults to plaintext for unknown files', () => {
    expect(getCodeLanguage('/tmp/example.custom')).toBe('plaintext');
  });
});
