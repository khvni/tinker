import type { JSX } from 'react';
import { IconButton } from '@tinker/design';

const BookmarkIcon = (): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
  </svg>
);

export type SaveAsSkillButtonProps = {
  readonly disabled?: boolean;
  readonly onClick: () => void;
};

/**
 * Header button that opens the "Save conversation as skill" modal.
 *
 * Kept as its own component so the Chat header renders a flat row of
 * controls and tests can exercise the disabled-while-streaming contract in
 * isolation.
 */
export const SaveAsSkillButton = ({
  disabled = false,
  onClick,
}: SaveAsSkillButtonProps): JSX.Element => {
  return (
    <IconButton
      variant="ghost"
      size="s"
      icon={<BookmarkIcon />}
      label="Save conversation as skill"
      onClick={onClick}
      disabled={disabled}
    />
  );
};
