import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextPill } from './ContextPill.js';

describe('<ContextPill>', () => {
  it('renders percent label', () => {
    render(<ContextPill percent={4} tokens={8000} windowSize={200_000} model="claude-sonnet-4-6" />);
    expect(screen.getByText('4%')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
  });

  it('clamps percent to 0 at minimum', () => {
    render(<ContextPill percent={-5} tokens={0} windowSize={200_000} model="m" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('clamps percent to 100 at maximum', () => {
    render(<ContextPill percent={150} tokens={300_000} windowSize={200_000} model="m" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('sets aria-label with tooltip', () => {
    render(<ContextPill percent={50} tokens={100_000} windowSize={200_000} model="claude-sonnet-4-6" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('title', '100,000 / 200,000 · claude-sonnet-4-6');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('Context 50%'));
  });
});
