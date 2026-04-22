import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal.js';
import { Button } from '../Button.js';

afterEach(() => cleanup());

describe('<Modal>', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog with title, body and actions when open', () => {
    render(
      <Modal
        open
        onClose={() => undefined}
        title="Delete vault"
        actions={<Button variant="danger">Delete</Button>}
      >
        <p>Are you sure?</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: /Delete vault/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Are you sure\?/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });

  it('Escape key triggers onClose by default', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="x">
        body
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape does nothing when closeOnEscape is false', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="x" closeOnEscape={false}>
        body
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop click triggers onClose by default', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="x">
        body
      </Modal>,
    );
    const scrim = container.querySelector('.tk-modal');
    if (scrim == null) throw new Error('scrim missing');
    fireEvent.mouseDown(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('card click does not trigger onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="x">
        body
      </Modal>,
    );
    const card = container.querySelector('.tk-modal__card');
    if (card == null) throw new Error('card missing');
    fireEvent.mouseDown(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop click skipped when closeOnBackdropClick is false', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="x" closeOnBackdropClick={false}>
        body
      </Modal>,
    );
    const scrim = container.querySelector('.tk-modal');
    if (scrim == null) throw new Error('scrim missing');
    fireEvent.mouseDown(scrim);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close button triggers onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="x">
        body
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the first focusable element on open', () => {
    render(
      <Modal
        open
        onClose={() => undefined}
        title="x"
        actions={<Button>Confirm</Button>}
      >
        body
      </Modal>,
    );
    // Close button renders first, so it should receive focus.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Close/ }));
  });

  it('uses aria-label when no title is provided', () => {
    render(
      <Modal open onClose={() => undefined} ariaLabel="Nameless dialog">
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Nameless dialog' })).toBeInTheDocument();
  });
});
