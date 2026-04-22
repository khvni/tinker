import { describe, expect, it } from 'vitest';
import { getChatLinkTarget, resolveWorkspaceFilePath } from './file-links.js';

describe('getChatLinkTarget', () => {
  it('treats relative links as workspace file targets', () => {
    expect(getChatLinkTarget('notes/today.md')).toEqual({
      kind: 'file',
      path: 'notes/today.md',
    });
  });

  it('normalizes file URLs into local file paths', () => {
    expect(getChatLinkTarget('file:///tmp/report.md')).toEqual({
      kind: 'file',
      path: '/tmp/report.md',
    });
  });

  it('treats Windows absolute paths as local file targets', () => {
    expect(getChatLinkTarget('C:/work/report.md')).toEqual({
      kind: 'file',
      path: 'C:/work/report.md',
    });
  });

  it('keeps safe external protocols as browser links', () => {
    expect(getChatLinkTarget('https://example.com/docs')).toEqual({
      kind: 'external',
      href: 'https://example.com/docs',
    });
  });

  it('rejects unsafe protocols', () => {
    expect(getChatLinkTarget('javascript:alert(1)')).toEqual({ kind: 'invalid' });
  });
});

describe('resolveWorkspaceFilePath', () => {
  it('resolves relative paths against the active session folder', () => {
    expect(resolveWorkspaceFilePath('notes/today.md', '/vault/session')).toBe(
      '/vault/session/notes/today.md',
    );
  });

  it('passes absolute paths through unchanged', () => {
    expect(resolveWorkspaceFilePath('/tmp/report.md', '/vault/session')).toBe('/tmp/report.md');
  });

  it('rejects paths that escape the session folder', () => {
    expect(resolveWorkspaceFilePath('../secrets.txt', '/vault/session')).toBeNull();
  });
});
