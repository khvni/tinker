import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx } from '../cx.js';
import './Menu.css';

export type MenuItem<TValue extends string = string> = {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
};

export type MenuProps<TValue extends string = string> = {
  readonly items: ReadonlyArray<MenuItem<TValue>>;
  readonly value?: TValue;
  readonly onSelect: (value: TValue) => void;
  readonly trigger: (args: { open: boolean; toggle: () => void; id: string }) => ReactElement;
  readonly disabled?: boolean;
  readonly placement?: 'top-start' | 'bottom-start';
  readonly align?: 'left' | 'right';
  readonly className?: string;
  readonly empty?: ReactNode;
};

export const Menu = <TValue extends string = string>({
  items,
  value,
  onSelect,
  trigger,
  disabled = false,
  placement = 'top-start',
  align = 'left',
  className,
  empty,
}: MenuProps<TValue>): JSX.Element => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const target = event.target;
      if (target instanceof Node && wrapper.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const handleSelect = (next: TValue, itemDisabled: boolean): void => {
    if (itemDisabled) return;
    onSelect(next);
    close();
  };

  return (
    <div ref={wrapperRef} className={cx('tk-menu', className)}>
      {trigger({ open, toggle, id: listId })}
      {open ? (
        <div
          role="menu"
          id={listId}
          className={cx(
            'tk-menu__panel',
            `tk-menu__panel--${placement}`,
            `tk-menu__panel--align-${align}`,
          )}
        >
          {items.length === 0 ? (
            <div className="tk-menu__empty">{empty ?? 'No options'}</div>
          ) : (
            items.map((item) => {
              const selected = item.value === value;
              const itemDisabled = !!item.disabled;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={itemDisabled}
                  className={cx(
                    'tk-menu__item',
                    selected && 'tk-menu__item--selected',
                    itemDisabled && 'tk-menu__item--disabled',
                  )}
                  onClick={() => handleSelect(item.value, itemDisabled)}
                >
                  <span className="tk-menu__item-label">{item.label}</span>
                  {item.description ? (
                    <span className="tk-menu__item-description">{item.description}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};
