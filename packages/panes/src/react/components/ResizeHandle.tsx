import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';

const RATIO_STEP = 0.02;
const RATIO_STEP_LARGE = 0.08;

export type ResizeHandleProps = {
  readonly orientation: 'row' | 'column';
  readonly ratio: number;
  readonly onChange: (ratio: number) => void;
  /** Pixel size of the split container along the relevant axis. Needed to translate drag deltas to ratio deltas. */
  readonly getContainerSize: () => number;
  readonly onResizeStart?: () => void;
  readonly onResizeEnd?: () => void;
  readonly ariaLabel?: string;
};

export const ResizeHandle = ({
  orientation,
  ratio,
  onChange,
  getContainerSize,
  onResizeStart,
  onResizeEnd,
  ariaLabel,
}: ResizeHandleProps) => {
  const dragStateRef = useRef<{
    startCoord: number;
    startRatio: number;
    pointerId: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        startCoord: orientation === 'row' ? event.clientX : event.clientY,
        startRatio: ratio,
        pointerId: event.pointerId,
      };
      onResizeStart?.();
    },
    [onResizeStart, orientation, ratio],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current;
      if (!state) return;
      const coord = orientation === 'row' ? event.clientX : event.clientY;
      const delta = coord - state.startCoord;
      const size = getContainerSize();
      if (size <= 0) return;
      const nextRatio = state.startRatio + delta / size;
      onChange(nextRatio);
    },
    [getContainerSize, onChange, orientation],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current;
      if (!state) return;
      event.currentTarget.releasePointerCapture(state.pointerId);
      dragStateRef.current = null;
      onResizeEnd?.();
    },
    [onResizeEnd],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const key = event.key;
      const decrease = orientation === 'row' ? 'ArrowLeft' : 'ArrowUp';
      const increase = orientation === 'row' ? 'ArrowRight' : 'ArrowDown';
      const step = event.shiftKey ? RATIO_STEP_LARGE : RATIO_STEP;
      if (key === decrease) {
        event.preventDefault();
        onChange(ratio - step);
        return;
      }
      if (key === increase) {
        event.preventDefault();
        onChange(ratio + step);
        return;
      }
      if (key === 'Home') {
        event.preventDefault();
        onChange(0.1);
        return;
      }
      if (key === 'End') {
        event.preventDefault();
        onChange(0.9);
      }
    },
    [onChange, orientation, ratio],
  );

  return (
    <button
      type="button"
      role="separator"
      aria-orientation={orientation === 'row' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={10}
      aria-valuemax={90}
      aria-label={ariaLabel ?? (orientation === 'row' ? 'Resize columns' : 'Resize rows')}
      className={`tinker-panes-resize tinker-panes-resize--${orientation}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  );
};
