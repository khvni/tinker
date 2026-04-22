import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsPane } from './SettingsPane.js';

describe('SettingsPane', () => {
  it('renders the settings placeholder copy', () => {
    const markup = renderToStaticMarkup(<SettingsPane />);

    expect(markup).toContain('Settings');
    expect(markup).toContain('Settings panel coming soon');
    expect(markup).toContain('workspace controls');
  });
});
