import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx.js';
import './Modal.css';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  closeOnBackdropClick?: boolean | undefined;
  closeOnEscape?: boolean | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  initialFocusRef?: React.RefObject<HTMLElement | null> | undefined;
};

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('data-modal-ignore-focus'),
  );

export const Modal = ({
  open,
  onClose,
  title,
  children,
  actions,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  ariaLabel,
  className,
  contentClassName,
  initialFocusRef,
}: ModalProps): JSX.Element | null => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const card = cardRef.current;
    if (card == null) return;
    const initial = initialFocusRef?.current ?? getFocusable(card)[0] ?? card;
    initial.focus();
    return () => {
      const prev = restoreRef.current;
      if (prev != null && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (card == null) return;
      const focusable = getFocusable(card);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first == null || last == null) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [],
  );

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdropClick) return;
      if (event.target !== event.currentTarget) return;
      onClose();
    },
    [closeOnBackdropClick, onClose],
  );

  if (!open) return null;

  return (
    <div
      className={cx('tk-modal', className)}
      data-theme-scope="modal"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={cardRef}
        className={cx('tk-modal__card', contentClassName)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        aria-label={title == null ? ariaLabel : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {title != null ? (
          <header className="tk-modal__header">
            <h2 id={titleId} className="tk-modal__title">
              {title}
            </h2>
            <button
              type="button"
              className="tk-modal__close"
              aria-label="Close"
              onClick={onClose}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 2L10 10M10 2L2 10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
        ) : null}
        <div className="tk-modal__body">{children}</div>
        {actions != null ? <footer className="tk-modal__footer">{actions}</footer> : null}
      </div>
    </div>
  );
};
