import { describe, expect, it } from 'vitest';
import { MAX_HIGHLIGHTABLE_CODE_LENGTH, highlightCode } from './code-highlighter.js';

describe('highlightCode', () => {
  it('returns highlighted html for supported languages', async () => {
    const html = await highlightCode('const answer = 42;', 'javascript');

    expect(html).toContain('hljs-keyword');
    expect(html).toContain('answer');
  });

  it('falls back for unsupported languages', async () => {
    await expect(highlightCode('plain text', 'plaintext')).resolves.toBeNull();
  });

  it('skips highlighting for oversized files', async () => {
    const oversized = 'x'.repeat(MAX_HIGHLIGHTABLE_CODE_LENGTH + 1);

    await expect(highlightCode(oversized, 'javascript')).resolves.toBeNull();
  });
});
