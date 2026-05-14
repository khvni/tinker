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
});
