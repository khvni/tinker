import type { HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import { isMac } from '../../utils/index.js';
import './KeyboardHint.css';

export type KeyboardHintOs = 'mac' | 'other';

export type KeyboardHintProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  keys: ReadonlyArray<string>;
  os?: KeyboardHintOs;
  label?: string;
};

const MAC_FORMAT: Record<string, string> = {
  cmd: '⌘',
  command: '⌘',
  meta: '⌘',
  super: '⌘',
  alt: '⌥',
  option: '⌥',
  opt: '⌥',
  shift: '⇧',
  ctrl: '⌃',
  control: '⌃',
  enter: '↵',
  return: '↵',
  tab: '⇥',
  backspace: '⌫',
  delete: '⌦',
  del: '⌦',
  esc: 'Esc',
  escape: 'Esc',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

const OTHER_FORMAT: Record<string, string> = {
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Win',
  super: 'Win',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  esc: 'Esc',
  escape: 'Esc',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

const detectOs = (): KeyboardHintOs => {
  if (typeof navigator === 'undefined') return 'other';
  return isMac() ? 'mac' : 'other';
};

const formatKey = (key: string, os: KeyboardHintOs): string => {
  const lookup = os === 'mac' ? MAC_FORMAT : OTHER_FORMAT;
  const mapped = lookup[key.toLowerCase()];
  if (mapped != null) return mapped;
  if (key.length === 1) return key.toUpperCase();
  return key;
};

export const KeyboardHint = ({ keys, os, label, className, ...rest }: KeyboardHintProps) => {
  const resolvedOs = os ?? detectOs();
  const formatted = keys.map((k) => ({ raw: k, display: formatKey(k, resolvedOs) }));
  const ariaLabel = label ?? formatted.map((k) => k.display).join(' ');

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className={cx('tk-kbdhint', className)}
      {...rest}
    >
      {formatted.map((k, i) => (
        <kbd
          key={`${k.raw}-${i}`}
          className={cx(
            'tk-kbdhint__key',
            k.display.length > 1 && 'tk-kbdhint__key--wide',
          )}
        >
          {k.display}
        </kbd>
      ))}
    </span>
  );
};
