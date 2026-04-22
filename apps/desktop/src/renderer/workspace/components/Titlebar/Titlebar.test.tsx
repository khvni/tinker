import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Titlebar } from './Titlebar.js';

describe('Titlebar', () => {
  it('renders the title with drag region + traffic-light spacer', () => {
    const markup = renderToStaticMarkup(<Titlebar title="Tinker" />);

    expect(markup).toContain('data-tauri-drag-region');
    expect(markup).toContain('tinker-titlebar__traffic-spacer');
    expect(markup).toContain('>Tinker<');
    expect(markup).toContain('aria-label="Toggle left panel"');
    expect(markup).toContain('aria-label="Toggle right panel"');
  });

  it('renders the session folder basename when provided as title', () => {
    const markup = renderToStaticMarkup(<Titlebar title="my-project" />);
    expect(markup).toContain('>my-project<');
  });
});
