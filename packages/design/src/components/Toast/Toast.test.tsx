import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast, type ToastApi, type ToastVariant } from './Toast.js';
import { useEffect, useRef, type JSX } from 'react';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const Harness = ({
  onReady,
}: {
  onReady: (api: ToastApi) => void;
}): JSX.Element => {
  const api = useToast();
  const emitted = useRef(false);
  useEffect(() => {
    if (!emitted.current) {
      emitted.current = true;
      onReady(api);
    }
  }, [api, onReady]);
  return <div />;
};

type Ready = (api: ToastApi) => void;

const renderWithProvider = (onReady: Ready): void => {
  render(
    <ToastProvider>
      <Harness onReady={onReady} />
    </ToastProvider>,
  );
};

describe('<ToastProvider> + useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('show renders a toast with title and description', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Saved', description: 'Vault indexed' });
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Vault indexed')).toBeInTheDocument();
  });

  it('assigns default variant info when not specified', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Hi' });
    });
    expect(screen.getByTestId('tk-toast')).toHaveAttribute('data-variant', 'info');
  });

  it.each<ToastVariant>(['success', 'warning', 'error', 'info'])(
    'renders variant %s',
    (variant) => {
      let api: ToastApi | null = null;
      renderWithProvider((a) => {
        api = a;
      });
      if (api == null) throw new Error('api not ready');
      act(() => {
        (api as ToastApi).show({ title: 'x', variant });
      });
      expect(screen.getByTestId('tk-toast')).toHaveAttribute('data-variant', variant);
    },
  );

  it('auto-dismisses after durationMs', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Fleeting', durationMs: 1000 });
    });
    expect(screen.getByText('Fleeting')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByText('Fleeting')).toBeNull();
  });

  it('durationMs of 0 disables auto-dismiss', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Sticky', durationMs: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });

  it('dismiss button removes the toast immediately', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Closable' });
    });
    expect(screen.getByText('Closable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(screen.queryByText('Closable')).toBeNull();
  });

  it('programmatic dismiss(id) removes the toast', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    let id = '';
    act(() => {
      id = (api as ToastApi).show({ title: 'Kill me' });
    });
    expect(screen.getByText('Kill me')).toBeInTheDocument();
    act(() => {
      (api as ToastApi).dismiss(id);
    });
    expect(screen.queryByText('Kill me')).toBeNull();
  });

  it('pauses timer on hover and resumes on mouseleave', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Pausable', durationMs: 1000 });
    });
    const node = screen.getByTestId('tk-toast');
    fireEvent.mouseEnter(node);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Pausable')).toBeInTheDocument();
    fireEvent.mouseLeave(node);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByText('Pausable')).toBeNull();
  });

  it('error variant uses role="alert"', () => {
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Boom', variant: 'error' });
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('action button fires onAction then dismisses', () => {
    const onAction = vi.fn();
    let api: ToastApi | null = null;
    renderWithProvider((a) => {
      api = a;
    });
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'Act', actionLabel: 'Undo', onAction });
    });
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Act')).toBeNull();
  });

  it('caps stack at max toasts, dropping oldest', () => {
    let api: ToastApi | null = null;
    render(
      <ToastProvider max={2}>
        <Harness onReady={(a) => (api = a)} />
      </ToastProvider>,
    );
    if (api == null) throw new Error('api not ready');
    act(() => {
      (api as ToastApi).show({ title: 'A', durationMs: 0 });
      (api as ToastApi).show({ title: 'B', durationMs: 0 });
      (api as ToastApi).show({ title: 'C', durationMs: 0 });
    });
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
