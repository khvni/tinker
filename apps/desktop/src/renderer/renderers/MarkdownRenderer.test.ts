import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './MarkdownRenderer.js';

describe('renderMarkdown', () => {
  it('renders GFM structures and highlighted code fences', async () => {
    const html = await renderMarkdown(`---
title: Demo
---

- [x] shipped
- [ ] next

~~deprecated~~

| left | right |
| --- | --- |
| a | b |

\`\`\`javascript
const answer = 42;
\`\`\``);

    expect(html).not.toContain('title: Demo');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>deprecated</del>');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('language-javascript');
  });

  it('renders empty string without error', async () => {
    const html = await renderMarkdown('');
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

  it('strips malformed frontmatter without closing delimiter', async () => {
    const html = await renderMarkdown('---title: no close\n---\n# Hello');
    // Malformed frontmatter should not throw — marked handles it gracefully
    expect(html).toContain('Hello');
  });

  it('handles XSS payloads without crashing', async () => {
    // renderMarkdown is a pure parsing function — DOMPurify sanitization
    // happens at the React component level (MarkdownRenderer.tsx).
    // The contract: renderMarkdown must never throw on any input,
    // and the consuming component applies DOMPurify.sanitize() before
    // feeding the result to dangerouslySetInnerHTML.
    const html = await renderMarkdown(`<script>alert(1)</script>

<img src=x onerror=alert(1)>

<svg onload=alert(1)>`);

    // Must not throw — should return the raw HTML
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
    // Raw output contains the dangerous tags (sanitization is the component's job)
    expect(html).toContain('<script>');
  });

  it('renders code fence with no language specified', async () => {
    const html = await renderMarkdown('```\nconsole.log("hello")\n```');
    expect(html).toContain('tinker-code-block');
    expect(html).toContain('hello');
  });

  it('handles nested code fences in a code block', async () => {
    const html = await renderMarkdown('````markdown\n```\ncode here\n```\n````');
    // Inner triple backticks should be escaped or rendered safely, not break the fence
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

  it('handles very long input without hanging', async () => {
    const longText = '# Heading\n\n' + 'paragraph '.repeat(10_000);
    const start = Date.now();
    const html = await renderMarkdown(longText);
    const elapsed = Date.now() - start;
    // Should complete in under 5 seconds
    expect(elapsed).toBeLessThan(5000);
    expect(html).toContain('Heading');
    expect(html).toContain('paragraph');
  });

  it('handles unicode and special characters correctly', async () => {
    const html = await renderMarkdown(`# Unicode Test

Emoji: 🎉 👨‍👩‍👧‍👦 🌍
CJK: 中文 日本語 한국어
RTL: ‮hello‭ world
Special: <>&"'`);
    // RTL override characters should not break rendering
    expect(html).toContain('Unicode');
    expect(html).toContain('CJK');
    // Special HTML chars should be escaped
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('renders table with mismatched column counts', async () => {
    const html = await renderMarkdown(`| a | b |
| - | - |
| x | y | z`);
    // Mismatched columns should not throw — marked handles it gracefully
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

  it('does not crash on javascript: link URLs', async () => {
    // javascript: URLs are a known XSS vector; DOMPurify strips them at the
    // component level. renderMarkdown must not throw on this input.
    const html = await renderMarkdown(`[click](javascript:alert(1))
[img](<img src=x onerror=alert(1)>)`);
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

  it('returns empty output for frontmatter-only document', async () => {
    const html = await renderMarkdown('---\ntitle: Only Meta\ntags: [a, b]\n---\n');
    // parseFrontmatter strips the block; marked receives an empty body
    expect(html).toBeDefined();
    expect(html.trim()).toBe('');
  });

  it('falls back to plain text for unsupported code fence language', async () => {
    const html = await renderMarkdown('```brainfuck\n++++++++[>++++[>++>+++\n```');
    // highlightCode returns null for unregistered languages →
    // renderHighlightedCodeBlock uses escapeHtml fallback, no hljs class
    expect(html).toContain('tinker-code-block');
    expect(html).not.toContain('hljs');
    expect(html).toContain('language-brainfuck');
  });

  it('extracts language from info string with extra tokens', async () => {
    // getCodeFenceLanguage splits on whitespace and takes the first token
    const html = await renderMarkdown('```typescript title="example" highlight={1-3}\nconst x = 1;\n```');
    expect(html).toContain('language-typescript');
    expect(html).toContain('hljs-keyword');
  });

  it('handles CRLF line endings in frontmatter and body', async () => {
    const crlf = '---\r\ntitle: Win\r\n---\r\n# Hello\r\n\r\nworld';
    const html = await renderMarkdown(crlf);
    // parseFrontmatter regex uses \r?\n — must strip frontmatter correctly
    expect(html).not.toContain('title: Win');
    expect(html).toContain('Hello');
    expect(html).toContain('world');
  });

  it('returns whitespace-only output for whitespace-only input', async () => {
    const html = await renderMarkdown('   \n\n\t\n  ');
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

  it('highlights multiple code blocks with mixed languages', async () => {
    const md = [
      '```javascript',
      'const a = 1;',
      '```',
      '',
      'Some text between blocks.',
      '',
      '```python',
      'x = 42',
      '```',
      '',
      '```unknownlang',
      'raw content',
      '```',
    ].join('\n');
    const html = await renderMarkdown(md);
    // walkTokens processes every code block
    expect(html).toContain('language-javascript');
    expect(html).toContain('language-python');
    // Unsupported language falls back without hljs class on that block
    expect(html).toContain('language-unknownlang');
    // All three blocks rendered (count <pre> open tags)
    expect((html.match(/<pre class="tinker-code-block/g) ?? []).length).toBe(3);
  });

  it('does not highlight inline code', async () => {
    const html = await renderMarkdown('Use `const x = 1` in your code.\n\n```javascript\nconst y = 2;\n```');
    // Inline backtick code should not go through walkTokens / highlightCode
    expect(html).toContain('<code>const x = 1</code>');
    // Block code should be highlighted
    expect(html).toContain('tinker-code-block');
    expect(html).toContain('language-javascript');
  });

  it('falls back to escapeHtml for code exceeding highlight length limit', async () => {
    // MAX_HIGHLIGHTABLE_CODE_LENGTH is 200_000
    const hugeCode = 'a'.repeat(200_001);
    const html = await renderMarkdown(`\`\`\`javascript\n${hugeCode}\n\`\`\``);
    // highlightCode returns null for oversized input → no hljs class
    expect(html).toContain('tinker-code-block');
    expect(html).not.toContain('tinker-code-block--highlighted');
    expect(html).toContain('language-javascript');
  });

  it('handles deeply nested blockquotes', async () => {
    const nested = Array.from({ length: 20 }, (_, i) => '>'.repeat(i + 1) + ' level ' + String(i + 1)).join('\n');
    const html = await renderMarkdown(nested);
    expect(html).toContain('blockquote');
    expect(html).toContain('level 1');
    expect(html).toContain('level 20');
  });

  it('auto-links bare URLs in GFM mode', async () => {
    const html = await renderMarkdown('Visit https://example.com for info.');
    expect(html).toContain('<a');
    expect(html).toContain('https://example.com');
  });
});
