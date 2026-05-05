import { describe, expect, it } from 'vitest';
import { createSharedSecretAuth, extractBearerToken } from './auth.js';

describe('extractBearerToken', () => {
  it('returns the token from a well-formed Bearer header', () => {
    expect(extractBearerToken('Bearer secret-value')).toBe('secret-value');
  });

  it('returns null for missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for non-Bearer prefix', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for empty token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });

  it('handles array headers by taking the first entry', () => {
    expect(extractBearerToken(['Bearer first', 'Bearer second'])).toBe('first');
  });
});

describe('createSharedSecretAuth', () => {
  it('throws when the secret is empty', () => {
    expect(() => createSharedSecretAuth('')).toThrow(/non-empty secret/u);
  });

  it('accepts the exact secret', () => {
    const provider = createSharedSecretAuth('s3cr3t-token');
    expect(provider.validate('s3cr3t-token')).toBe(true);
  });

  it('rejects null, empty, and mismatched tokens', () => {
    const provider = createSharedSecretAuth('s3cr3t-token');
    expect(provider.validate(null)).toBe(false);
    expect(provider.validate('')).toBe(false);
    expect(provider.validate('wrong-token')).toBe(false);
  });

  it('rejects tokens of differing length without throwing', () => {
    const provider = createSharedSecretAuth('s3cr3t-token');
    expect(provider.validate('s3cr3t-token-with-suffix')).toBe(false);
    expect(provider.validate('short')).toBe(false);
  });
});
