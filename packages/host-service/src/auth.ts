import { timingSafeEqual } from 'node:crypto';
import type { HostAuthProvider } from './types.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Extract a PSK token from an `Authorization: Bearer <secret>` header.
 * Returns `null` for missing / malformed headers (no exception leakage to
 * route handlers).
 */
export const extractBearerToken = (header: string | string[] | undefined): string | null => {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || !value.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = value.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * Build a `HostAuthProvider` that compares against a fixed secret using a
 * length-stable, timing-safe comparison. The device coordinator generates
 * the secret and supplies it via env var; this helper is the trivial
 * validator the host wires into `createHostApp`.
 */
export const createSharedSecretAuth = (secret: string): HostAuthProvider => {
  if (secret.length === 0) {
    throw new Error('createSharedSecretAuth requires a non-empty secret.');
  }

  const expected = Buffer.from(secret, 'utf8');
  return {
    validate: (token) => {
      if (typeof token !== 'string' || token.length === 0) {
        return false;
      }

      const candidate = Buffer.from(token, 'utf8');
      if (candidate.length !== expected.length) {
        return false;
      }

      return timingSafeEqual(candidate, expected);
    },
  };
};
