import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState.js';
import { Button } from '../Button.js';

afterEach(() => cleanup());

describe('<EmptyState>', () => {
  it('renders the title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('announces itself with role=status', () => {
    render(<EmptyState title="x" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="x" description="All quiet in the vault." />);
    expect(screen.getByText('All quiet in the vault.')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="x"
        icon={<svg data-testid="icon" />}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="x"
        action={<Button>Connect</Button>}
      />,
    );
    expect(screen.getByRole('button', { name: /Connect/ })).toBeInTheDocument();
  });

  it('respects size prop via class', () => {
    const { container } = render(<EmptyState title="x" size="s" />);
    expect(container.querySelector('.tk-empty-state--s')).not.toBeNull();
  });

  it('respects align prop via class', () => {
    const { container } = render(<EmptyState title="x" align="start" />);
    expect(container.querySelector('.tk-empty-state--align-start')).not.toBeNull();
  });
});
