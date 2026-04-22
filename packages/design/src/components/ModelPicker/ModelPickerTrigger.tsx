import type { JSX } from 'react';
import { cx } from '../cx.js';
import type { ModelPickerItem } from './ModelPicker.js';

export type ModelPickerTriggerProps = {
  readonly selected: ModelPickerItem | undefined;
  readonly fallbackLabel: string;
  readonly disabled: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
};

const ChevronDownIcon = (): JSX.Element => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="tk-modelpicker__chevron"
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

export const ModelPickerTrigger = ({
  selected,
  fallbackLabel,
  disabled,
  open,
  onToggle,
}: ModelPickerTriggerProps): JSX.Element => {
  const label = selected != null ? selected.name : fallbackLabel;
  return (
    <button
      type="button"
      className={cx(
        'tk-modelpicker__trigger',
        open && 'tk-modelpicker__trigger--open',
        disabled && 'tk-modelpicker__trigger--disabled',
      )}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="tk-modelpicker__trigger-icon" aria-hidden="true" />
      <span className="tk-modelpicker__trigger-label">{label}</span>
      <ChevronDownIcon />
    </button>
  );
};
