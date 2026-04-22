import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { cx } from '../cx.js';
import './Toast.css';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export type ToastInput = {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export type Toast = ToastInput & {
  id: string;
  variant: ToastVariant;
};

export type ToastApi = {
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION_MS = 4200;

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (ctx == null) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

export type ToastProviderProps = {
  children: ReactNode;
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  max?: number;
};

let seq = 0;
const nextId = (): string => `toast-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const ToastProvider = ({
  children,
  placement = 'bottom-right',
  max = 4,
}: ToastProviderProps): JSX.Element => {
  const [toasts, setToasts] = useState<ReadonlyArray<Toast>>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer != null) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (id: string, durationMs: number) => {
      const existing = timers.current.get(id);
      if (existing != null) clearTimeout(existing);
      if (durationMs <= 0) return;
      const handle = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, handle);
    },
    [dismiss],
  );

  const clearTimer = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle != null) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const id = nextId();
      const variant: ToastVariant = input.variant ?? 'info';
      const durationMs = input.durationMs ?? DEFAULT_DURATION_MS;
      const toast: Toast = { ...input, id, variant };
      setToasts((prev) => {
        const combined = [...prev, toast];
        if (combined.length <= max) return combined;
        const dropped = combined.slice(0, combined.length - max);
        for (const t of dropped) {
          const timer = timers.current.get(t.id);
          if (timer != null) {
            clearTimeout(timer);
            timers.current.delete(t.id);
          }
        }
        return combined.slice(-max);
      });
      schedule(id, durationMs);
      return id;
    },
    [max, schedule],
  );

  useEffect(() => {
    const handles = timers.current;
    return () => {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport
        toasts={toasts}
        placement={placement}
        onDismiss={dismiss}
        onPause={clearTimer}
        onResume={(id, durationMs) => schedule(id, durationMs)}
      />
    </ToastContext.Provider>
  );
};

type ToastViewportProps = {
  toasts: ReadonlyArray<Toast>;
  placement: Exclude<ToastProviderProps['placement'], undefined>;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string, durationMs: number) => void;
};

const ToastViewport = ({
  toasts,
  placement,
  onDismiss,
  onPause,
  onResume,
}: ToastViewportProps): JSX.Element => (
  <div
    className={cx('tk-toast-viewport', `tk-toast-viewport--${placement}`)}
    aria-live="polite"
    aria-atomic="false"
  >
    {toasts.map((toast) => (
      <ToastRow
        key={toast.id}
        toast={toast}
        onDismiss={() => onDismiss(toast.id)}
        onPause={() => onPause(toast.id)}
        onResume={() => onResume(toast.id, toast.durationMs ?? DEFAULT_DURATION_MS)}
      />
    ))}
  </div>
);

type ToastRowProps = {
  toast: Toast;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
};

const ToastRow = ({ toast, onDismiss, onPause, onResume }: ToastRowProps): JSX.Element => (
  <div
    className={cx('tk-toast', `tk-toast--${toast.variant}`)}
    role={toast.variant === 'error' ? 'alert' : 'status'}
    data-testid="tk-toast"
    data-variant={toast.variant}
    onMouseEnter={onPause}
    onMouseLeave={onResume}
    onFocus={onPause}
    onBlur={onResume}
  >
    <span className="tk-toast__dot" aria-hidden="true" />
    <div className="tk-toast__body">
      <div className="tk-toast__title">{toast.title}</div>
      {toast.description != null ? (
        <div className="tk-toast__description">{toast.description}</div>
      ) : null}
    </div>
    {toast.actionLabel != null && toast.onAction != null ? (
      <button
        type="button"
        className="tk-toast__action"
        onClick={() => {
          toast.onAction?.();
          onDismiss();
        }}
      >
        {toast.actionLabel}
      </button>
    ) : null}
    <button
      type="button"
      className="tk-toast__close"
      aria-label="Dismiss"
      onClick={onDismiss}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M2 2L8 8M8 2L2 8"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  </div>
);
