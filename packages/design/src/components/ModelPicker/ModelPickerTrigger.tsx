import type { JSX } from 'react';
import { cx } from '../cx.js';
import type { ModelPickerItem, ModelPickerVariant } from './ModelPicker.js';

export type ModelPickerTriggerProps = {
  readonly selected: ModelPickerItem | undefined;
  readonly fallbackLabel: string;
  readonly disabled: boolean;
  readonly open: boolean;
  readonly variant: ModelPickerVariant;
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

const ProviderGlyph = ({ providerId }: { readonly providerId: string }): JSX.Element => {
  if (providerId === 'anthropic') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  // Generic glyph for other providers
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
};

export const ModelPickerTrigger = ({
  selected,
  fallbackLabel,
  disabled,
  open,
  variant,
  onToggle,
}: ModelPickerTriggerProps): JSX.Element => {
  const isDock = variant === 'dock';
  const label = selected != null ? selected.name : fallbackLabel;
  const providerLabel = selected?.providerName ?? '';

  return (
    <button
      type="button"
      className={cx(
        'tk-modelpicker__trigger',
        isDock && 'tk-modelpicker__trigger--dock',
        open && 'tk-modelpicker__trigger--open',
        disabled && 'tk-modelpicker__trigger--disabled',
      )}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="tk-modelpicker__trigger-icon" aria-hidden="true">
        {selected ? <ProviderGlyph providerId={selected.providerId} /> : null}
      </span>
      {isDock && providerLabel ? (
        <>
          <span className="tk-modelpicker__trigger-provider">{providerLabel}</span>
          <span className="tk-modelpicker__trigger-separator" aria-hidden="true" />
        </>
      ) : null}
      <span className="tk-modelpicker__trigger-label">{label}</span>
      <ChevronDownIcon />
    </button>
  );
};
