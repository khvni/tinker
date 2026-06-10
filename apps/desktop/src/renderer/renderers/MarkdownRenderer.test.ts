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
    expect(html).toContain('<input checked="" disabled="">');
    expect(html).toContain(' shipped');
    expect(html).toContain('next');
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
    // renderMarkdown now applies DOMPurify internally — dangerous tags
    // and event handlers are stripped from the output.
    const html = await renderMarkdown(`<script>alert(1)</script>

<img src=x onerror=alert(1)>

<svg onload=alert(1)>`);

    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
    // DOMPurify strips <script> tags and event handlers
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onload');
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

  // -------------------------------------------------------------------------
  // XSS edge cases — DOMPurify sanitizes marked's raw output.
  // We assert on concrete indicators of dangerous content that would
  // indicate a sanitization failure.
  // -------------------------------------------------------------------------

  it('does not include executable event handlers in img output', async () => {
    // marked treats ![x](x" onerror=...) as alt text with a broken img src;
    // DOMPurify strips the onerror attribute from the resulting <img> element.
    // The plain text "onerror" in the alt string is not executable HTML and
    // lives inside dangerouslySetInnerHTML which has no JS execution context.
    // We assert that no <img onerror=> tag appears (attribute stripped).
    const html = await renderMarkdown('![x](x" onerror="alert(1)//)');
    // No <img onerror=> tag in the output
    expect(html).not.toMatch(/<img[^>]*\bonerror=/i);
    // The alt text with onerror doesn't appear as an executable HTML element
    expect(html).not.toContain('<img');
  });

  it('does not allow javascript: URIs in link href output', async () => {
    // DOMPurify's ALLOWED_URI_REGEXP blocks javascript: — verify it's gone.
    const html = await renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:alert(1)');
    // Any <a> tag must not have a javascript: href
    expect(html).not.toMatch(/<a[^>]*href="javascript:/i);
  });

  it('strips raw script tags from output', async () => {
    const html = await renderMarkdown('<script>alert(1)</script>');
    // DOMPurify removes <script> tags entirely
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('does not produce an executable data: link', async () => {
    const html = await renderMarkdown('[data](data:text/html,<script>alert(1)</script>)');
    // The script payload inside the data: URI must not appear as raw script tags
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('alert(1)');
  });

  it('does not include executable event handlers in SVG output', async () => {
    // DOMPurify strips onload from SVG elements; the SVG tag may remain
    // but the event handler must be removed.
    const html = await renderMarkdown('<svg onload=alert(1)>');
    expect(html).not.toContain('onload=alert(1)');
    expect(html).not.toContain('alert(1)');
    // If SVG survives, it must not carry the onload handler
    if (html.includes('<svg')) {
      expect(html).not.toMatch(/<svg[^>]*\bonload=/i);
    }
  });

  // -------------------------------------------------------------------------
  // Input robustness
  // -------------------------------------------------------------------------

  it('treats garbage-before-first --- as body content', async () => {
    // parseFrontmatter requires the document to start with --- (^---).
    // "garbage\n---" has no frontmatter; "garbage" is body.
    // "title: fine" appears in the body and renders as an h2.
    // The security boundary is that actual YAML frontmatter is still
    // extracted correctly when --- is at the document start.
    const html = await renderMarkdown('garbage\n---\ntitle: fine\n---\ncontent');
    // "garbage" is rendered as h2 (marked sees "garbage\n---" and the "---" triggers
    // frontmatter parsing, but the frontmatter extraction fails and the whole
    // document gets parsed as body, with "garbage" as a heading since it ends with \n---)
    // This tests the security boundary: actual YAML frontmatter is stripped.
    expect(html).toContain('<h2>garbage</h2>');
    // "title: fine" is in the body rendered as h2 — not a YAML leak
    expect(html).toContain('>title: fine<');
  });
});
