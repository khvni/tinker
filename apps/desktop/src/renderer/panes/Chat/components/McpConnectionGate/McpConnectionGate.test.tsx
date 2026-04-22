import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpConnectionGate } from './McpConnectionGate.js';

const services = [
  { id: 'qmd', label: 'qmd', status: 'connected' as const },
  { id: 'smart-connections', label: 'smart-connections', status: 'pending' as const },
  { id: 'exa', label: 'exa', status: 'pending' as const },
];

afterEach(() => cleanup());

describe('<McpConnectionGate>', () => {
  it('renders the waiting copy without retry controls while services are still connecting', () => {
    render(<McpConnectionGate services={services} onRetry={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByText('Connecting tools…')).toBeInTheDocument();
    expect(screen.getByText('Waiting for qmd, smart-connections, and exa before enabling the composer.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('surfaces retry and skip actions when the gate is in an error state', () => {
    render(
      <McpConnectionGate
        services={services.map((service) =>
          service.id === 'exa' ? { ...service, status: 'error', detail: 'Timed out' as const } : service,
        )}
        errorMessage="Timed out"
        onRetry={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByText('Tool connection stalled')).toBeInTheDocument();
    expect(screen.getAllByText('Timed out')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
  });
});
