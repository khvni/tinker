import type { JSX } from 'react';
import { SegmentedControl } from '@tinker/design';
import type { ReasoningLevel } from '@tinker/shared-types';

type ReasoningPickerProps = {
  value: ReasoningLevel;
  onChange: (next: ReasoningLevel) => void;
};

const REASONING_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export const ReasoningPicker = ({
  value,
  onChange,
}: ReasoningPickerProps): JSX.Element => {
  return (
    <SegmentedControl<ReasoningLevel>
      value={value}
      onChange={onChange}
      options={REASONING_OPTIONS}
      label="Reasoning level"
    />
  );
};
