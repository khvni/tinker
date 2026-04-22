import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure } from './Disclosure.js';

afterEach(() => cleanup());

describe('<Disclosure>', () => {
  it('renders the summary and hides children when uncontrolled and defaultOpen=false', () => {
    render(
      <Disclosure summary="used read">
        <p>file body</p>
      </Disclosure>,
    );

    expect(screen.getByRole('button', { name: 'used read' })).toBeInTheDocument();
    expect(screen.queryByText('file body')).toBeNull();
  });

  it('reveals children after a click in uncontrolled mode', () => {
    render(
      <Disclosure summary="used read">
        <p>file body</p>
      </Disclosure>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'used read' }));

    expect(screen.getByText('file body')).toBeInTheDocument();
  });

  it('reflects controlled `open` and emits onOpenChange without flipping internal state', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Disclosure summary="thinking" open={false} onOpenChange={onOpenChange}>
        <p>secret</p>
      </Disclosure>,
    );

    expect(screen.queryByText('secret')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'thinking' }));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Still hidden — controlled mode means parent owns the state.
    expect(screen.queryByText('secret')).toBeNull();

    rerender(
      <Disclosure summary="thinking" open={true} onOpenChange={onOpenChange}>
        <p>secret</p>
      </Disclosure>,
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('applies the reasoning tone modifier', () => {
    const { container } = render(
      <Disclosure summary="thinking…" tone="reasoning" defaultOpen>
        <p>inner</p>
      </Disclosure>,
    );

    const root = container.querySelector('.tk-disclosure');
    expect(root).not.toBeNull();
    expect(root?.classList.contains('tk-disclosure--reasoning')).toBe(true);
    expect(root?.classList.contains('tk-disclosure--open')).toBe(true);
  });
});
