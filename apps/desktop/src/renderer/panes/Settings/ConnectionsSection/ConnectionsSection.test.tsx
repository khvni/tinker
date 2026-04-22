import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionsSection } from './ConnectionsSection.js';

describe('ConnectionsSection', () => {
  it('renders the three built-in MCP rows with eyebrow and heading', () => {
    const markup = renderToStaticMarkup(
      <ConnectionsSection
        opencode={null}
        vaultPath={null}
        memoryPath={null}
        seedStatuses={{
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        }}
        onRequestRespawn={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).toContain('Connections');
    expect(markup).toContain('Built-in tools');
    expect(markup).toContain('qmd');
    expect(markup).toContain('smart-connections');
    expect(markup).toContain('exa');
  });

  it('hides the retry button when a row is connected', () => {
    const markup = renderToStaticMarkup(
      <ConnectionsSection
        opencode={null}
        vaultPath={null}
        memoryPath="/Users/alice/memory"
        seedStatuses={{
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        }}
        onRequestRespawn={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).not.toContain('>Retry<');
  });

  it('shows a retry button and the actionable error when a row is failed', () => {
    const markup = renderToStaticMarkup(
      <ConnectionsSection
        opencode={null}
        vaultPath={null}
        memoryPath={null}
        seedStatuses={{
          qmd: {
            status: 'failed',
            error: 'SMART_VAULT_PATH is not set. Pick a memory folder.',
          },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        }}
        onRequestRespawn={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).toContain('>Retry<');
    expect(markup).toContain('SMART_VAULT_PATH is not set. Pick a memory folder.');
  });

  it('exposes a "+ Add tool" CTA', () => {
    const markup = renderToStaticMarkup(
      <ConnectionsSection
        opencode={null}
        vaultPath={null}
        memoryPath={null}
        seedStatuses={{
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        }}
        onRequestRespawn={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).toContain('Add tool');
  });

  it('does not render the picker modal before the CTA is clicked', () => {
    const markup = renderToStaticMarkup(
      <ConnectionsSection
        opencode={null}
        vaultPath={null}
        memoryPath={null}
        seedStatuses={{
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        }}
        onRequestRespawn={vi.fn(async () => undefined)}
      />,
    );

    // The picker modal only mounts when `open` flips true via interaction.
    expect(markup).not.toContain('Add a tool');
  });
});
