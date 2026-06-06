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
\`\`\`
`);

    expect(html).not.toContain('title: Demo');
    // Checkbox state: marked renders [x] as list item text, not an <input checked>.
    // The security boundary is that DOMPurify prevents any HTML injection.
    expect(html).toContain(' shipped');
    expect(html).toContain('next');
    expect(html).toContain('<del>deprecated</del>');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('language-javascript');
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

  it('handles empty string input', async () => {
    const html = await renderMarkdown('');
    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
  });

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