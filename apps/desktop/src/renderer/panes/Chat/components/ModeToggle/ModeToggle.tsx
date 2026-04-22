import type { JSX } from 'react';
import { SegmentedControl } from '@tinker/design';
import type { SessionMode } from '@tinker/shared-types';

type ModeToggleProps = {
  value: SessionMode;
  onChange: (next: SessionMode) => void;
};

const MODE_OPTIONS = [
  { value: 'build', label: 'Build' },
  { value: 'plan', label: 'Plan' },
] as const;

export const ModeToggle = ({
  value,
  onChange,
}: ModeToggleProps): JSX.Element => {
  return (
    <SegmentedControl<SessionMode>
      value={value}
      onChange={onChange}
      options={MODE_OPTIONS}
      label="Chat mode"
    />
  );
};
