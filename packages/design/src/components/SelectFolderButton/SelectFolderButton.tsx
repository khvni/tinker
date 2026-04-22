import type { ButtonHTMLAttributes } from 'react';
import { Progress } from '../Progress/index.js';
import { cx } from '../cx.js';
import './SelectFolderButton.css';

export type SelectFolderButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> & {
  folderPath?: string | null;
  loading?: boolean;
  placeholder?: string;
};

const basenameOf = (path: string): string => {
  const normalized = path.replace(/[\\/]+$/, '');
  const fromPosix = normalized.lastIndexOf('/');
  const fromWindows = normalized.lastIndexOf('\\');
  const cut = Math.max(fromPosix, fromWindows);
  return cut === -1 ? normalized : normalized.slice(cut + 1);
};

const FolderIcon = () => (
  <svg
    className="tk-select-folder__icon"
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.5 3.25c0-.41.34-.75.75-.75h2l1 1.25h4c.41 0 .75.34.75.75v3.75c0 .41-.34.75-.75.75h-7c-.41 0-.75-.34-.75-.75V3.25z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronIcon = () => (
  <svg
    className="tk-select-folder__chevron"
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.5 4l2.5 2.5L7.5 4"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SelectFolderButton = ({
  folderPath,
  loading = false,
  placeholder = 'Select folder',
  disabled,
  className,
  type = 'button',
  ...rest
}: SelectFolderButtonProps) => {
  const hasFolder = Boolean(folderPath);
  const basename = folderPath ? basenameOf(folderPath) : placeholder;
  const label = loading ? 'Starting…' : basename;
  const ariaLabel = hasFolder ? `Session folder: ${basename}. Click to change.` : placeholder;

  return (
    <button
      type={type}
      className={cx(
        'tk-select-folder',
        hasFolder && 'tk-select-folder--has-folder',
        loading && 'tk-select-folder--loading',
        disabled && 'tk-select-folder--disabled',
        className,
      )}
      title={folderPath ?? placeholder}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      <FolderIcon />
      <span className="tk-select-folder__label">{label}</span>
      {loading ? <Progress variant="spinner" size="xs" label="Starting OpenCode" /> : <ChevronIcon />}
    </button>
  );
};
