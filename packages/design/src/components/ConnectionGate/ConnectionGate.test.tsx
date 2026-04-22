import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ConnectionGate, type ConnectionService } from './ConnectionGate.js';

const threeMCPs: ReadonlyArray<ConnectionService> = [
  { id: 'qmd', label: 'qmd', status: 'connected' },
  { id: 'smart-connections', label: 'smart-connections', status: 'pending' },
  { id: 'exa', label: 'exa', status: 'pending' },
];

afterEach(() => cleanup());

describe('<ConnectionGate>', () => {
  it('renders a row per service with its status label', () => {
    render(<ConnectionGate services={threeMCPs} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('qmd')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Connected')).toBeInTheDocument();
    expect(within(rows[1]!).getAllByText('Connecting…').length).toBeGreaterThan(0);
  });

  it('marks the region busy while any service is pending', () => {
    const { container } = render(<ConnectionGate services={threeMCPs} />);
    const region = container.firstElementChild;
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('clears busy when every service is connected', () => {
    const all: ReadonlyArray<ConnectionService> = threeMCPs.map((s) => ({ ...s, status: 'connected' }));
    const { container } = render(<ConnectionGate services={all} />);
    const region = container.firstElementChild;
    expect(region).toHaveAttribute('aria-busy', 'false');
  });

  it('surfaces custom detail text over the default status label', () => {
    const services: ReadonlyArray<ConnectionService> = [
      { id: 'exa', label: 'exa', status: 'error', detail: 'Network timeout' },
    ];
    render(<ConnectionGate services={services} />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('accepts a custom title', () => {
    render(<ConnectionGate services={threeMCPs} title="Starting tools…" />);
    expect(screen.getByText('Starting tools…')).toBeInTheDocument();
  });
});
