import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconButtonSize = 's' | 'm' | 'l';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: ReactNode;
  label: string;
};

export const IconButton = ({
  variant = 'secondary',
  size = 'm',
  icon,
  label,
  className,
  disabled,
  type = 'button',
  ...rest
}: IconButtonProps) => {
  const classes = [
    'tk-iconbutton',
    `tk-iconbutton--${variant}`,
    `tk-iconbutton--size-${size}`,
    disabled ? 'tk-iconbutton--disabled' : null,
    className ?? null,
  ]
    .filter((token): token is string => Boolean(token))
    .join(' ');

  return (
    <button type={type} className={classes} aria-label={label} title={label} disabled={disabled} {...rest}>
      <span className="tk-iconbutton__icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
};
