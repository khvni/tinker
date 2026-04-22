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
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>deprecated</del>');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('language-javascript');
  });
});
