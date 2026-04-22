import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeBlock } from './CodeBlock.js';

describe('CodeBlock', () => {
  it('renders the language label and copy affordance', () => {
    const markup = renderToStaticMarkup(<CodeBlock language="typescript" code="const x = 1;" />);

    expect(markup).toContain('tinker-chat-codeblock');
    expect(markup).toContain('tinker-chat-codeblock__header');
    expect(markup).toContain('tinker-chat-codeblock__lang');
    expect(markup).toContain('typescript');
    expect(markup).toContain('tinker-chat-codeblock__copy');
    expect(markup).toContain('Copy');
  });

  it('renders the raw code text before highlight resolves', () => {
    const markup = renderToStaticMarkup(<CodeBlock language="bash" code="echo hi" />);

    expect(markup).toContain('echo hi');
    expect(markup).toContain('language-bash');
  });
});
