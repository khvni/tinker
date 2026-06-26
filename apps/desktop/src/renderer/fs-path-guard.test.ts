// @vitest-environment node
// Tests for the fs-path-guard applied to IPC handlers in apps/desktop/src/main/main.ts.
// Since the main process handlers are not directly testable from Vitest (no Electron),
// we test the guardFsPath logic inline here using the same implementation.

import { describe, expect, it } from 'vitest';
import { normalize } from 'node:path';
import { homedir } from 'node:os';

// Inline the guard logic so tests run without Electron context.
// This is the exact logic applied to each IPC handler.
const guardFsPath = (filePath: string): void => {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid path');
  const normalized = normalize(filePath);
  if (normalized.includes('..')) throw new Error('Path traversal not allowed');
  const home = normalize(homedir());
  if (!normalized.startsWith(home + '/') && !normalized.startsWith('/tmp/')) {
    throw new Error('Path outside allowed directory');
  }
};

describe('guardFsPath', () => {
  const home = normalize(homedir());

  it('allows paths under home directory', () => {
    expect(() => guardFsPath(`${home}/Documents/vault/notes.md`)).not.toThrow();
    expect(() => guardFsPath(`${home}/.config/tinker.json`)).not.toThrow();
  });

  it('allows /tmp paths', () => {
    expect(() => guardFsPath('/tmp/tinker-export.md')).not.toThrow();
    expect(() => guardFsPath('/tmp/')).not.toThrow();
  });

  it('blocks traversal attempts with ..', () => {
    // path.normalize resolves .. first — e.g. /home/user/../../etc/passwd → /etc/passwd.
    // The path is blocked by the home-dir check, not the .. check.
    expect(() => guardFsPath(`${home}/../../etc/passwd`)).toThrow();
    expect(() => guardFsPath(`${home}/notes/../../../.ssh/id_rsa`)).toThrow();
    // /tmp/../../../root resolves to /root — outside /tmp, blocked.
    expect(() => guardFsPath('/tmp/../../../root/.bashrc')).toThrow();
  });

  it('blocks paths completely outside home and /tmp', () => {
    expect(() => guardFsPath('/etc/passwd')).toThrow('Path outside allowed directory');
    expect(() => guardFsPath('/usr/local/bin/script.sh')).toThrow('Path outside allowed directory');
    expect(() => guardFsPath('/var/log/syslog')).toThrow('Path outside allowed directory');
  });

  it('rejects null and undefined', () => {
    expect(() => guardFsPath(null as unknown as string)).toThrow('Invalid path');
    expect(() => guardFsPath(undefined as unknown as string)).toThrow('Invalid path');
  });

  it('rejects non-string values', () => {
    expect(() => guardFsPath(123 as unknown as string)).toThrow('Invalid path');
    expect(() => guardFsPath({} as unknown as string)).toThrow('Invalid path');
    expect(() => guardFsPath([] as unknown as string)).toThrow('Invalid path');
  });

  it('blocks non-traversal but out-of-bounds absolute paths', () => {
    expect(() => guardFsPath('/opt/app/secret.txt')).toThrow('Path outside allowed directory');
    expect(() => guardFsPath('/root/.ssh/id_rsa')).toThrow('Path outside allowed directory');
  });
});
