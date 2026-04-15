import { describe, expect, it } from 'vitest';
import { normalizeVaultRelativePath, relativeVaultPath, resolveVaultPath } from './vault-utils.js';

describe('vault path utilities', () => {
  it('resolves note paths inside a POSIX vault root', () => {
    expect(resolveVaultPath('/Users/test/Vault', 'notes/Welcome.md')).toBe('/Users/test/Vault/notes/Welcome.md');
    expect(resolveVaultPath('/', 'Welcome.md')).toBe('/Welcome.md');
  });

  it('resolves note paths inside a Windows drive root', () => {
    expect(resolveVaultPath('C:/', 'notes/Welcome.md')).toBe('C:\\notes\\Welcome.md');
    expect(resolveVaultPath('C:/Vault', 'notes/Welcome.md')).toBe('C:\\Vault\\notes\\Welcome.md');
  });

  it('normalizes relative paths without stripping filename whitespace', () => {
    expect(normalizeVaultRelativePath('  spaced note.md  ')).toBe('  spaced note.md  ');
    expect(normalizeVaultRelativePath('folder/  spaced note.md  ')).toBe('folder/  spaced note.md  ');
  });

  it('rejects traversal attempts', () => {
    expect(() => normalizeVaultRelativePath('../escape.md')).toThrow(/cannot escape/u);
    expect(() => normalizeVaultRelativePath('/escape.md')).toThrow(/must be relative/u);
    expect(() => normalizeVaultRelativePath('..\\escape.md', 'windows')).toThrow(/cannot escape/u);
    expect(() => normalizeVaultRelativePath('C:\\escape.md', 'windows')).toThrow(/must be relative/u);
  });

  it('derives relative paths case-insensitively for Windows vaults', () => {
    expect(relativeVaultPath('C:/Vault', 'c:\\vault\\Notes\\Welcome.md')).toBe('Notes/Welcome.md');
  });

  it('rejects files outside the configured vault root', () => {
    expect(() => relativeVaultPath('/Users/test/Vault', '/Users/test/Other/file.md')).toThrow(/outside vault root/u);
    expect(() => relativeVaultPath('C:/Vault', 'D:\\Vault\\file.md')).toThrow(/outside vault root/u);
  });
});
