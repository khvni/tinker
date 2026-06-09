import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Adoption manifest — persisted to disk so a restarting Electron process
 * can discover and adopt a still-running host.
 *
 * Per feature-11 §Coordinator: secret **hash** on disk, never the raw PSK.
 * The device keeps the raw secret in memory; on rediscovery it hashes its
 * in-memory secret and compares against the manifest.
 */

export type ManifestEntry = {
  hostId: string;
  pid: number;
  port: number;
  secretHash: string;
  startedAt: string;
};

export type WriteManifestOptions = {
  manifestDir: string;
  hostId: string;
  pid: number;
  port: number;
  secret: string;
};

const hashSecret = (secret: string): string => {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
};

const isManifestEntry = (value: unknown): value is ManifestEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['hostId'] === 'string' &&
    typeof c['pid'] === 'number' &&
    typeof c['port'] === 'number' &&
    typeof c['secretHash'] === 'string' &&
    typeof c['startedAt'] === 'string'
  );
};

/**
 * Write an adoption manifest for the given host.
 * Creates the directory if needed. Overwrites any existing manifest for this hostId.
 */
export const writeManifest = (options: WriteManifestOptions): void => {
  const { manifestDir, hostId, pid, port, secret } = options;
  mkdirSync(manifestDir, { recursive: true });

  const entry: ManifestEntry = {
    hostId,
    pid,
    port,
    secretHash: hashSecret(secret),
    startedAt: new Date().toISOString(),
  };

  const path = join(manifestDir, `${hostId}.json`);
  writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};

/**
 * Read a single manifest entry. Returns `null` if not found or malformed.
 */
export const readManifest = (manifestDir: string, hostId: string): ManifestEntry | null => {
  const path = join(manifestDir, `${hostId}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isManifestEntry(parsed) ? parsed : null;
};

/**
 * List all manifest entries in the directory.
 */
export const listManifests = (manifestDir: string): ManifestEntry[] => {
  let files: string[];
  try {
    files = readdirSync(manifestDir);
  } catch {
    return [];
  }

  const entries: ManifestEntry[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const hostId = file.slice(0, -5);
    const entry = readManifest(manifestDir, hostId);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  return entries;
};

/**
 * Validate that a raw secret matches the hash in a manifest entry.
 */
export const validateManifestSecret = (entry: ManifestEntry, secret: string): boolean => {
  return hashSecret(secret) === entry.secretHash;
};

/**
 * Remove a manifest file for the given hostId.
 */
export const removeManifest = (manifestDir: string, hostId: string): void => {
  const path = join(manifestDir, `${hostId}.json`);
  try {
    rmSync(path, { force: true });
  } catch {
    // best-effort cleanup
  }
};
