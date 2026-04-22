import { describe, expect, it } from 'vitest';
import { extractEntities } from './entity-extractor.js';

describe('extractEntities', () => {
  it('extracts mentions and wikilinks with line-context descriptions', () => {
    const entities = extractEntities(
      'Met with @jane about [[Q2 Launch]].\n@jane owns rollout.',
      'sessions/2026-04-22.md',
      '2026-04-22T12:00:00.000Z',
    );

    expect(entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'person',
          name: 'jane',
          lastSeenAt: '2026-04-22T12:00:00.000Z',
          attributes: { description: 'Met with @jane about [[Q2 Launch]].' },
          sources: [{ service: 'vault', ref: 'sessions/2026-04-22.md', lastSeen: '2026-04-22T12:00:00.000Z' }],
        }),
        expect.objectContaining({
          kind: 'document',
          name: 'Q2 Launch',
          attributes: { description: 'Met with @jane about [[Q2 Launch]].' },
        }),
      ]),
    );
  });

  it('extracts explicit typed markers for memory files', () => {
    const entities = extractEntities(
      ['PROJECT: Q2 Launch', 'ORG: Tinker', 'EVENT: Launch review'].join('\n'),
      'sessions/2026-04-22.md',
      '2026-04-22T12:00:00.000Z',
    );

    expect(entities.map((entity) => `${entity.kind}:${entity.name}`)).toEqual([
      'project:Q2 Launch',
      'organization:Tinker',
      'event:Launch review',
    ]);
  });
});
