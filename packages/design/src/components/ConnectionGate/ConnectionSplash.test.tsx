import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConnectionSplash } from './ConnectionSplash.js';
import type { ConnectionService } from './ConnectionGate.js';

const fullStack: ReadonlyArray<ConnectionService> = [
  { id: 'host', label: 'Host service', status: 'connected' },
  { id: 'auth', label: 'Auth sidecar', status: 'connected' },
  { id: 'opencode', label: 'OpenCode', status: 'pending' },
  { id: 'mcps', label: 'MCP servers', status: 'pending' },
];

afterEach(() => cleanup());

describe('<ConnectionSplash>', () => {
  it('renders as an aria-modal dialog with the default title', () => {
    render(<ConnectionSplash services={fullStack} />);
    const dialog = screen.getByRole('dialog', { name: /Starting Tinker/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the Tinker wordmark by default', () => {
    render(<ConnectionSplash services={fullStack} />);
    expect(screen.getByText('Tinker')).toBeInTheDocument();
  });

  it('renders every service row from the nested ConnectionGate', () => {
    render(<ConnectionSplash services={fullStack} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('Host service')).toBeInTheDocument();
    expect(screen.getByText('Auth sidecar')).toBeInTheDocument();
    expect(screen.getByText('OpenCode')).toBeInTheDocument();
    expect(screen.getByText('MCP servers')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <ConnectionSplash
        services={fullStack}
        subtitle="Boots your local host, auth, and tools."
      />,
    );
    expect(screen.getByText('Boots your local host, auth, and tools.')).toBeInTheDocument();
  });

  it('accepts custom title and wordmark overrides', () => {
    render(
      <ConnectionSplash
        services={fullStack}
        title="Reconnecting…"
        wordmark="Tinker Dev"
      />,
    );
    expect(screen.getByRole('dialog', { name: /Reconnecting/i })).toBeInTheDocument();
    expect(screen.getByText('Tinker Dev')).toBeInTheDocument();
  });
});
