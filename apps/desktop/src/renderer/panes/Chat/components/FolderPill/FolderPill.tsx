import type { ButtonHTMLAttributes } from 'react';
import './FolderPill.css';

export type FolderPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly open?: boolean;
};

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 10l4-4 4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FolderPill = ({ open = false, className, type = 'button', disabled, ...rest }: FolderPillProps) => {
  return (
    <button
      type={type}
      className={[
        'folder-pill',
        open ? 'folder-pill--open' : '',
        disabled ? 'folder-pill--disabled' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={disabled}
      {...rest}
    >
      <span className="folder-pill__icon" aria-hidden="true">
        <FolderIcon />
      </span>
      <ChevronUpIcon />
    </button>
  );
};
