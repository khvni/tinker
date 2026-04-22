import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryPane } from './MemoryPane.js';

describe('MemoryPane', () => {
  it('renders the memory placeholder copy', () => {
    const markup = renderToStaticMarkup(<MemoryPane />);

    expect(markup).toContain('Memory');
    expect(markup).toContain('Memory view coming soon');
    expect(markup).toContain('memory filesystem');
  });
});
