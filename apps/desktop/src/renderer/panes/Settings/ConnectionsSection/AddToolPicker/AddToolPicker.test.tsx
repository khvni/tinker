import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddToolPicker } from './AddToolPicker.js';
import { CATALOG_MCPS } from './available-mcps.js';

describe('AddToolPicker', () => {
  it('renders nothing when closed', () => {
    const markup = renderToStaticMarkup(
      <AddToolPicker open={false} onClose={vi.fn()} onAdd={vi.fn()} existingIds={[]} />,
    );
    expect(markup).toBe('');
  });

  it('shows the catalog and custom MCP card when open', () => {
    const markup = renderToStaticMarkup(
      <AddToolPicker open onClose={vi.fn()} onAdd={vi.fn()} existingIds={[]} />,
    );

    expect(markup).toContain('Add a tool');
    expect(markup).toContain('Custom MCP');
    for (const mcp of CATALOG_MCPS) {
      expect(markup).toContain(mcp.label);
    }
  });

  it('renders Composio as a catalog entry with Set up button', () => {
    const markup = renderToStaticMarkup(
      <AddToolPicker open onClose={vi.fn()} onAdd={vi.fn()} existingIds={[]} />,
    );

    expect(markup).toContain('Composio');
    expect(markup).toContain('Set up');
  });

  it('marks catalog items as disabled when already added', () => {
    const markup = renderToStaticMarkup(
      <AddToolPicker open onClose={vi.fn()} onAdd={vi.fn()} existingIds={['composio']} />,
    );

    expect(markup).toContain('Already added');
    expect(markup).toContain('aria-disabled="true"');
  });
});
