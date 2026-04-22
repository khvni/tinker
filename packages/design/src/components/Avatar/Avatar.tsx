import { useEffect, useState, type HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export type AvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  name: string;
  src?: string;
  size?: AvatarSize;
};

const PALETTE_COUNT = 6;

const initialsFor = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const parts = trimmed.split(/\s+/u);
  if (parts.length === 1) {
    const [first = ''] = parts;
    return first.slice(0, 1).toUpperCase();
  }
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
};

const paletteIndex = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE_COUNT;
  return idx;
};

export const Avatar = ({
  name,
  src,
  size = 'md',
  className,
  ...rest
}: AvatarProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = typeof src === 'string' && src.length > 0 && !failed;
  const initials = initialsFor(name);
  const paletteId = `p${paletteIndex(name)}`;

  return (
    <span
      className={cx(
        'tk-avatar',
        `tk-avatar--${size}`,
        !showImage ? `tk-avatar--${paletteId}` : null,
        className,
      )}
      role="img"
      aria-label={name}
      {...rest}
    >
      {showImage ? (
        <img
          className="tk-avatar__image"
          src={src}
          alt=""
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <span className="tk-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
};
