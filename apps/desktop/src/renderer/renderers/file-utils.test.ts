import { describe, expect, it } from 'vitest';
import { getCodeLanguage, tildify } from './file-utils.js';

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

describe('tildify', () => {
  it('replaces an exact home directory match with ~', () => {
    expect(tildify('/Users/ali', '/Users/ali')).toBe('~');
  });

  it('replaces a posix home prefix with ~/...', () => {
    expect(tildify('/Users/ali/projects/tinker', '/Users/ali')).toBe('~/projects/tinker');
    expect(tildify('/home/ali/projects/tinker', '/home/ali')).toBe('~/projects/tinker');
  });

  it('tolerates trailing separators on the home dir', () => {
    expect(tildify('/Users/ali/projects', '/Users/ali/')).toBe('~/projects');
  });

  it('replaces a windows-style home prefix with ~\\...', () => {
    expect(tildify('C:\\Users\\ali\\projects', 'C:\\Users\\ali')).toBe('~\\projects');
  });

  it('returns the original path when home dir is missing or empty', () => {
    expect(tildify('/Users/ali/projects', null)).toBe('/Users/ali/projects');
    expect(tildify('/Users/ali/projects', '')).toBe('/Users/ali/projects');
  });

  it('returns the original path when it sits outside the home directory', () => {
    expect(tildify('/tmp/foo', '/Users/ali')).toBe('/tmp/foo');
    expect(tildify('/Users/alicia/projects', '/Users/ali')).toBe('/Users/alicia/projects');
  });
});
