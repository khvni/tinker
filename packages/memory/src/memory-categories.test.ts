import { describe, expect, it } from 'vitest';
import {
  bucketForFrontmatter,
  bucketForRelativePath,
  DISMISS_TOMBSTONE_FILE,
  MEMORY_CATEGORY_DIRECTORIES,
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_ORDER,
  PENDING_DIRECTORY,
} from './memory-categories.js';

describe('memory-categories constants', () => {
  it('exposes the canonical five-category order', () => {
    expect(MEMORY_CATEGORY_ORDER).toEqual([
      'people',
      'active-work',
      'capabilities',
      'preferences',
      'organization',
    ]);
  });

  it('pairs every category with a title-cased label', () => {
    expect(MEMORY_CATEGORY_LABELS).toMatchObject({
      people: 'People',
      'active-work': 'Active Work',
      capabilities: 'Capabilities',
      preferences: 'Preferences',
      organization: 'Organization',
    });
  });

  it('maps every category to its slug folder name', () => {
    expect(MEMORY_CATEGORY_DIRECTORIES).toMatchObject({
      people: 'people',
      'active-work': 'active-work',
      capabilities: 'capabilities',
      preferences: 'preferences',
      organization: 'organization',
    });
  });

  it('uses a single pending directory and dismissal log filename', () => {
    expect(PENDING_DIRECTORY).toBe('pending');
    expect(DISMISS_TOMBSTONE_FILE).toBe('.dismissed.log');
  });
});

describe('bucketForFrontmatter', () => {
  it('returns the canonical category for title-cased kinds', () => {
    expect(bucketForFrontmatter({ kind: 'People' })).toBe('people');
  });

  it('normalizes underscore-separated kinds to their dashed canonical form', () => {
    expect(bucketForFrontmatter({ kind: 'active_work' })).toBe('active-work');
  });

  it('accepts already-canonical kind slugs', () => {
    expect(bucketForFrontmatter({ kind: 'preferences' })).toBe('preferences');
    expect(bucketForFrontmatter({ kind: 'active-work' })).toBe('active-work');
  });

  it('handles whitespace noise', () => {
    expect(bucketForFrontmatter({ kind: '  Organization  ' })).toBe('organization');
    expect(bucketForFrontmatter({ kind: 'active work' })).toBe('active-work');
  });

  it('returns null when kind is missing or empty', () => {
    expect(bucketForFrontmatter({})).toBeNull();
    expect(bucketForFrontmatter({ kind: '' })).toBeNull();
    expect(bucketForFrontmatter({ kind: '   ' })).toBeNull();
  });

  it('returns null when kind is an unrecognized value', () => {
    expect(bucketForFrontmatter({ kind: 'whatever' })).toBeNull();
  });

  it('returns null when kind is not a string', () => {
    expect(bucketForFrontmatter({ kind: 42 })).toBeNull();
    expect(bucketForFrontmatter({ kind: ['active-work'] })).toBeNull();
  });
});

describe('bucketForRelativePath', () => {
  it('buckets pending entries', () => {
    expect(bucketForRelativePath('pending/foo.md')).toBe('pending');
    expect(bucketForRelativePath('pending/nested/bar.md')).toBe('pending');
  });

  it('buckets category entries by first path segment', () => {
    expect(bucketForRelativePath('people/bar.md')).toBe('people');
    expect(bucketForRelativePath('active-work/plan.md')).toBe('active-work');
    expect(bucketForRelativePath('capabilities/skill.md')).toBe('capabilities');
    expect(bucketForRelativePath('preferences/style.md')).toBe('preferences');
    expect(bucketForRelativePath('organization/team.md')).toBe('organization');
  });

  it('returns null for unrecognised top-level directories', () => {
    expect(bucketForRelativePath('notes/baz.md')).toBeNull();
    expect(bucketForRelativePath('sessions/2026-04-22-foo.md')).toBeNull();
  });

  it('returns null for empty paths', () => {
    expect(bucketForRelativePath('')).toBeNull();
    expect(bucketForRelativePath('/')).toBeNull();
  });
});
