import { describe, expect, it } from 'vitest';
import {
  bucketForRelativePath,
  DISMISS_TOMBSTONE_FILE,
  MEMORY_CATEGORY_ORDER,
  MEMORY_FOLDER_ORDER,
  PENDING_MEMORY_CATEGORY,
  isMemoryCategoryId,
} from './memory-categories.js';

describe('memory-categories constants', () => {
  it('exposes the canonical five-category order', () => {
    expect(MEMORY_CATEGORY_ORDER).toEqual([
      'People',
      'Active Work',
      'Capabilities',
      'Preferences',
      'Organization',
    ]);
  });

  it('uses the exact Paper folder names under each user memory root', () => {
    expect(MEMORY_FOLDER_ORDER).toEqual([
      'Pending',
      'People',
      'Active Work',
      'Capabilities',
      'Preferences',
      'Organization',
    ]);
    expect(PENDING_MEMORY_CATEGORY).toBe('Pending');
    expect(DISMISS_TOMBSTONE_FILE).toBe('.dismissed.log');
  });
});

describe('isMemoryCategoryId', () => {
  it('accepts only exact category folder names', () => {
    expect(isMemoryCategoryId('People')).toBe(true);
    expect(isMemoryCategoryId('Active Work')).toBe(true);
    expect(isMemoryCategoryId('people')).toBe(false);
    expect(isMemoryCategoryId('active-work')).toBe(false);
    expect(isMemoryCategoryId(' Active Work ')).toBe(false);
  });
});

describe('bucketForRelativePath', () => {
  it('buckets pending entries', () => {
    expect(bucketForRelativePath('Pending/foo.md')).toBe('Pending');
    expect(bucketForRelativePath('Pending/nested/bar.md')).toBe('Pending');
  });

  it('buckets category entries by first path segment', () => {
    expect(bucketForRelativePath('People/bar.md')).toBe('People');
    expect(bucketForRelativePath('Active Work/plan.md')).toBe('Active Work');
    expect(bucketForRelativePath('Capabilities/skill.md')).toBe('Capabilities');
    expect(bucketForRelativePath('Preferences/style.md')).toBe('Preferences');
    expect(bucketForRelativePath('Organization/team.md')).toBe('Organization');
  });

  it('returns null for unrecognised top-level directories', () => {
    expect(bucketForRelativePath('notes/baz.md')).toBeNull();
    expect(bucketForRelativePath('sessions/2026-04-22-foo.md')).toBeNull();
    expect(bucketForRelativePath('pending/foo.md')).toBeNull();
    expect(bucketForRelativePath('active-work/plan.md')).toBeNull();
  });

  it('returns null for empty paths', () => {
    expect(bucketForRelativePath('')).toBeNull();
    expect(bucketForRelativePath('/')).toBeNull();
  });
});
