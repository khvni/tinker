import { describe, expect, it } from 'vitest';
import { appendManagedFacts, collectWikilinks, inferEntityKindFromNote } from './memory-utils.js';

describe('appendManagedFacts', () => {
  it('creates managed section when missing', () => {
    const result = appendManagedFacts('# Jane Smith\n', [{ date: '2026-04-15', text: 'Leads [[Q2 Launch]].' }]);

    expect(result.appended).toBe(1);
    expect(result.body).toContain('## Tinker Memory');
    expect(result.body).toContain('- [2026-04-15] Leads [[Q2 Launch]].');
  });

  it('dedupes identical fact text and keeps later sections intact', () => {
    const body = [
      '# Jane Smith',
      '',
      '## Tinker Memory',
      '- [2026-04-14] Leads [[Q2 Launch]].',
      '',
      '## Notes',
      'Keep existing section.',
    ].join('\n');

    const result = appendManagedFacts(body, [
      { date: '2026-04-15', text: 'Leads [[Q2 Launch]].' },
      { date: '2026-04-15', text: 'Met with [[Launch Team]].' },
    ]);

    expect(result.appended).toBe(1);
    expect(result.body).toContain('- [2026-04-15] Met with [[Launch Team]].');
    expect(result.body).toContain('## Notes\nKeep existing section.');
    expect(result.body.match(/Leads \[\[Q2 Launch\]\]\./gu)).toHaveLength(1);
  });
});

describe('inferEntityKindFromNote', () => {
  it('prefers frontmatter type when valid', () => {
    expect(inferEntityKindFromNote('People/Jane Smith.md', { type: 'organization' })).toBe('organization');
  });

  it('falls back to folder name when frontmatter lacks type', () => {
    expect(inferEntityKindFromNote('Projects/Q2 Launch.md', {})).toBe('project');
    expect(inferEntityKindFromNote('Scratch.md', {})).toBe('document');
  });
});

describe('collectWikilinks', () => {
  it('returns unique bare wikilink targets', () => {
    expect(collectWikilinks('See [[Alpha]] and [[Alpha]] plus [[Beta]].')).toEqual(['Alpha', 'Beta']);
  });
});
