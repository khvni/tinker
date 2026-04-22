import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx.js';
import { IconButton } from '../IconButton.js';
import { Textarea } from '../Textarea.js';
import './PromptComposer.css';

export type PromptComposerProps = {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit: () => void;
  readonly onAbort?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly canSubmit?: boolean;
  readonly rows?: number;
  readonly attachmentIcon?: ReactNode;
  readonly onAttach?: () => void;
  readonly attachDisabled?: boolean;
  readonly attachLabel?: string;
  /** Top-left slot — e.g. ContextPill */
  readonly contextSlot?: ReactNode;
  /** Top-right slot — e.g. StatusDot + Kebab menu */
  readonly statusSlot?: ReactNode;
  /** Bottom row left-side controls — e.g. Mode chip, ModelPicker, ReasoningPicker */
  readonly controls?: ReactNode;
  /** Bottom row right-side trailing slot — e.g. FolderPill */
  readonly trailingSlot?: ReactNode;
  readonly textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  readonly className?: string;
};

const DEFAULT_PLACEHOLDER = 'Ask anything… "What dependencies are outdated?"';
const MIN_ROWS = 3;
const MAX_HEIGHT_PX = 220;

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 3.5v9M3.5 8h9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 13V3M4 7l4-4 4 4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <rect x="2" y="2" width="8" height="8" rx="1.5" />
  </svg>
);

const readPx = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const autosize = (node: HTMLTextAreaElement | null): void => {
  if (!node || typeof window === 'undefined') return;
  const styles = window.getComputedStyle(node);
  const padTop = readPx(styles.paddingTop);
  const padBot = readPx(styles.paddingBottom);
  const borderTop = readPx(styles.borderTopWidth);
  const borderBot = readPx(styles.borderBottomWidth);
  node.style.height = 'auto';
  const raw = node.scrollHeight + borderTop + borderBot - padTop - padBot + padTop + padBot;
  const capped = Math.min(raw, MAX_HEIGHT_PX);
  node.style.maxHeight = `${MAX_HEIGHT_PX}px`;
  node.style.height = `${capped}px`;
  node.style.overflowY = raw > MAX_HEIGHT_PX ? 'auto' : 'hidden';
};

export const PromptComposer = forwardRef<HTMLTextAreaElement, PromptComposerProps>(
  function PromptComposer(
    {
      value,
      onChange,
      onSubmit,
      onAbort,
      onKeyDown,
      placeholder = DEFAULT_PLACEHOLDER,
      disabled = false,
      busy = false,
      canSubmit = true,
      rows = MIN_ROWS,
      attachmentIcon,
      onAttach,
      attachDisabled = false,
      attachLabel = 'Add attachment',
      contextSlot,
      statusSlot,
      controls,
      trailingSlot,
      textareaRef,
      className,
    },
    forwardedRef,
  ): JSX.Element {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (textareaRef) {
          (textareaRef as { current: HTMLTextAreaElement | null }).current = node;
        }
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) {
          (forwardedRef as { current: HTMLTextAreaElement | null }).current = node;
        }
      },
      [forwardedRef, textareaRef],
    );

    useLayoutEffect(() => {
      autosize(internalRef.current);
    }, [value]);

    const submitDisabled = disabled || busy || !canSubmit || value.trim().length === 0;
    const sendClickable = busy ? !!onAbort : !submitDisabled;
    const hasTopRow = Boolean(contextSlot) || Boolean(statusSlot);
    const hasBottomRow = Boolean(controls) || Boolean(trailingSlot);

    return (
      <div className={cx('tk-prompt-composer', className)}>
        {hasTopRow ? (
          <div className="tk-prompt-composer__top-row">
            <div className="tk-prompt-composer__context-slot">{contextSlot}</div>
            <div className="tk-prompt-composer__status-slot">{statusSlot}</div>
          </div>
        ) : null}
        <div
          className={cx(
            'tk-prompt-composer__card',
            busy && 'tk-prompt-composer__card--busy',
            disabled && 'tk-prompt-composer__card--disabled',
          )}
        >
          <Textarea
            ref={setRef}
            value={value}
            rows={rows}
            resize="none"
            placeholder={placeholder}
            onChange={(event) => onChange(event.currentTarget.value)}
            {...(onKeyDown ? { onKeyDown } : {})}
            disabled={disabled}
            className="tk-prompt-composer__textarea"
          />
          <div className="tk-prompt-composer__row">
            <IconButton
              variant="ghost"
              size="s"
              icon={attachmentIcon ?? <PlusIcon />}
              label={attachLabel}
              disabled={attachDisabled || disabled || busy}
              {...(onAttach ? { onClick: onAttach } : {})}
              aria-disabled={attachDisabled || !onAttach ? true : undefined}
              className="tk-prompt-composer__attach"
            />
            <button
              type="button"
              className={cx(
                'tk-prompt-composer__send',
                busy && 'tk-prompt-composer__send--busy',
                !sendClickable && 'tk-prompt-composer__send--disabled',
              )}
              aria-label={busy ? 'Stop response' : 'Send message'}
              title={busy ? 'Stop response' : 'Send message'}
              disabled={!sendClickable}
              onClick={() => {
                if (busy) onAbort?.();
                else onSubmit();
              }}
            >
              {busy ? <StopIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
        {hasBottomRow ? (
          <div className="tk-prompt-composer__bottom-row">
            <div className="tk-prompt-composer__controls">{controls}</div>
            <div className="tk-prompt-composer__trailing-slot">{trailingSlot}</div>
          </div>
        ) : null}
      </div>
    );
  },
);
