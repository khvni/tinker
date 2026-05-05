import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Intrinsic host identity, per [[D17]].
 *
 * `hostId` is derived from `os.hostname()` plus a random suffix persisted to
 * disk on first run. The suffix is never accepted as configuration — that
 * would defeat "intrinsic". Persistence isolates the identity from hostname
 * changes and OS reinstalls (the suffix file becomes the canonical anchor).
 */

const DEFAULT_IDENTITY_DIR = join(homedir(), '.tinker');
const DEFAULT_IDENTITY_FILE = 'host-identity.json';
const HOST_ID_LENGTH = 16;
const SUFFIX_BYTES = 16;

export type HostIdentity = {
  hostId: string;
  hostName: string;
};

type IdentityFileContents = {
  suffix: string;
};

export type LoadHostIdentityOptions = {
  /** Override directory for the identity file. Defaults to `~/.tinker`. */
  identityDir?: string;
  /** Override file name. Defaults to `host-identity.json`. */
  identityFile?: string;
};

const isIdentityFileContents = (value: unknown): value is IdentityFileContents => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'suffix' in value &&
    typeof (value as { suffix: unknown }).suffix === 'string' &&
    (value as { suffix: string }).suffix.length > 0
  );
};

const readSuffix = (path: string): string | null => {
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

  return isIdentityFileContents(parsed) ? parsed.suffix : null;
};

const writeSuffix = (path: string, suffix: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  const payload: IdentityFileContents = { suffix };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};

const computeHostId = (name: string, suffix: string): string => {
  return createHash('sha256').update(`${name}:${suffix}`).digest('hex').slice(0, HOST_ID_LENGTH);
};

/**
 * Load (or generate + persist) the intrinsic host identity.
 *
 * On first call the suffix is generated with `crypto.randomBytes` and written
 * to `<identityDir>/<identityFile>`. Subsequent calls reuse it.
 */
export const loadHostIdentity = (options: LoadHostIdentityOptions = {}): HostIdentity => {
  const dir = options.identityDir ?? DEFAULT_IDENTITY_DIR;
  const file = options.identityFile ?? DEFAULT_IDENTITY_FILE;
  const path = join(dir, file);

  let suffix = readSuffix(path);
  if (suffix === null) {
    suffix = randomBytes(SUFFIX_BYTES).toString('hex');
    writeSuffix(path, suffix);
  }

  const name = hostname();
  return {
    hostId: computeHostId(name, suffix),
    hostName: name,
  };
};
