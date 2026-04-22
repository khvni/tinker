import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx.js';
import './ComposerChip.css';

export type ComposerChipVariant = 'default' | 'primary';

export type ComposerChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly label: string;
  readonly secondaryLabel?: string;
  readonly variant?: ComposerChipVariant;
  readonly open?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly showChevron?: boolean;
};

const ChevronDownIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="tk-composer-chip__chevron"
  >
    <path
      d="M4 6l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ComposerChip = forwardRef<HTMLButtonElement, ComposerChipProps>(
  function ComposerChip(
    { label, secondaryLabel, variant = 'default', open = false, leadingIcon, showChevron = true, className, type = 'button', disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'tk-composer-chip',
          `tk-composer-chip--${variant}`,
          open && 'tk-composer-chip--open',
          disabled && 'tk-composer-chip--disabled',
          className,
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        {...rest}
      >
        {leadingIcon ? (
          <span className="tk-composer-chip__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <span className="tk-composer-chip__label">{label}</span>
        {secondaryLabel ? (
          <>
            <span className="tk-composer-chip__separator" aria-hidden="true" />
            <span className="tk-composer-chip__secondary-label">{secondaryLabel}</span>
          </>
        ) : null}
        {showChevron ? <ChevronDownIcon /> : null}
      </button>
    );
  },
);
