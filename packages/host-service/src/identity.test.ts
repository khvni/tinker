import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadHostIdentity } from './identity.js';

describe('loadHostIdentity', () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-host-identity-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('generates a 16-char hex hostId on first call and persists the suffix', () => {
    const first = loadHostIdentity({ identityDir: scratch });

    expect(first.hostId).toMatch(/^[0-9a-f]{16}$/u);
    expect(first.hostName.length).toBeGreaterThan(0);

    const persisted = JSON.parse(readFileSync(join(scratch, 'host-identity.json'), 'utf8')) as {
      suffix: string;
    };
    expect(persisted.suffix).toMatch(/^[0-9a-f]{32}$/u);
  });

  it('returns the same hostId on subsequent calls', () => {
    const first = loadHostIdentity({ identityDir: scratch });
    const second = loadHostIdentity({ identityDir: scratch });

    expect(second.hostId).toBe(first.hostId);
    expect(second.hostName).toBe(first.hostName);
  });

  it('regenerates the suffix when the identity file is malformed', () => {
    const file = join(scratch, 'host-identity.json');
    writeFileSync(file, 'not-json{', 'utf8');

    const identity = loadHostIdentity({ identityDir: scratch });
    expect(identity.hostId).toMatch(/^[0-9a-f]{16}$/u);

    const persisted = JSON.parse(readFileSync(file, 'utf8')) as { suffix: string };
    expect(persisted.suffix).toMatch(/^[0-9a-f]{32}$/u);
  });

  it('regenerates the suffix when the file is missing the suffix field', () => {
    writeFileSync(join(scratch, 'host-identity.json'), JSON.stringify({ hostId: 'oops' }), 'utf8');

    const identity = loadHostIdentity({ identityDir: scratch });
    expect(identity.hostId).toMatch(/^[0-9a-f]{16}$/u);
  });

  it('honors a custom identity file name', () => {
    const identity = loadHostIdentity({ identityDir: scratch, identityFile: 'alt.json' });
    expect(identity.hostId).toMatch(/^[0-9a-f]{16}$/u);

    const stored = JSON.parse(readFileSync(join(scratch, 'alt.json'), 'utf8')) as { suffix: string };
    expect(stored.suffix).toMatch(/^[0-9a-f]{32}$/u);
  });
});
