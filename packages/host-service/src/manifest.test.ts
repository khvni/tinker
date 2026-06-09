import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  listManifests,
  readManifest,
  removeManifest,
  validateManifestSecret,
  writeManifest,
} from './manifest.js';

describe('manifest', () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-manifest-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('writes and reads a manifest entry', () => {
    writeManifest({
      manifestDir: scratch,
      hostId: 'abc123',
      pid: 42,
      port: 8080,
      secret: 'my-secret',
    });

    const entry = readManifest(scratch, 'abc123');
    expect(entry).not.toBeNull();
    expect(entry?.hostId).toBe('abc123');
    expect(entry?.pid).toBe(42);
    expect(entry?.port).toBe(8080);
    expect(typeof entry?.secretHash).toBe('string');
    expect(entry?.secretHash).not.toBe('my-secret');
    expect(typeof entry?.startedAt).toBe('string');
  });

  it('stores a hash, not the raw secret', () => {
    writeManifest({
      manifestDir: scratch,
      hostId: 'hash-test',
      pid: 1,
      port: 1,
      secret: 'raw-secret',
    });

    const entry = readManifest(scratch, 'hash-test');
    expect(entry?.secretHash).not.toBe('raw-secret');
    expect(entry?.secretHash?.length).toBe(64);
  });

  it('validates the correct secret', () => {
    writeManifest({
      manifestDir: scratch,
      hostId: 'validate-test',
      pid: 1,
      port: 1,
      secret: 'correct-secret',
    });

    const entry = readManifest(scratch, 'validate-test');
    expect(entry).not.toBeNull();
    expect(validateManifestSecret(entry!, 'correct-secret')).toBe(true);
    expect(validateManifestSecret(entry!, 'wrong-secret')).toBe(false);
  });

  it('returns null for missing manifests', () => {
    expect(readManifest(scratch, 'nonexistent')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    writeFileSync(join(scratch, 'bad.json'), 'not-json{', 'utf8');
    expect(readManifest(scratch, 'bad')).toBeNull();
  });

  it('returns null for wrong shape', () => {
    writeFileSync(join(scratch, 'shape.json'), JSON.stringify({ wrong: true }), 'utf8');
    expect(readManifest(scratch, 'shape')).toBeNull();
  });

  it('lists all valid manifests', () => {
    writeManifest({ manifestDir: scratch, hostId: 'host-a', pid: 1, port: 100, secret: 'a' });
    writeManifest({ manifestDir: scratch, hostId: 'host-b', pid: 2, port: 200, secret: 'b' });
    writeFileSync(join(scratch, 'bad.json'), 'nope', 'utf8');

    const entries = listManifests(scratch);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.hostId).sort()).toEqual(['host-a', 'host-b']);
  });

  it('returns empty list for nonexistent directory', () => {
    expect(listManifests('/nonexistent/dir')).toEqual([]);
  });

  it('removes a manifest', () => {
    writeManifest({ manifestDir: scratch, hostId: 'removable', pid: 1, port: 1, secret: 'x' });
    expect(readManifest(scratch, 'removable')).not.toBeNull();

    removeManifest(scratch, 'removable');
    expect(readManifest(scratch, 'removable')).toBeNull();
  });

  it('removeManifest is safe for nonexistent files', () => {
    expect(() => removeManifest(scratch, 'ghost')).not.toThrow();
  });
});
