import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyPane } from './EmptyPane.js';

describe('EmptyPane', () => {
  it('renders a friendly empty state without throwing', () => {
    const markup = renderToStaticMarkup(
      <EmptyPane
        eyebrow="Settings"
        title="Settings panel coming soon"
        description="Account, memory, and integration controls will land here in a follow-up MVP task."
      />,
    );

    expect(markup).toContain('Settings');
    expect(markup).toContain('Settings panel coming soon');
    expect(markup).toContain('follow-up MVP task');
    expect(markup).toContain('role="status"');
  });
});
