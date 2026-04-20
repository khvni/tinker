import type { TextareaHTMLAttributes } from 'react';
import './Textarea.css';

export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  resize?: TextareaResize;
};

export const Textarea = ({
  className,
  resize = 'vertical',
  rows = 4,
  ...rest
}: TextareaProps) => {
  const classes = ['tk-textarea', `tk-textarea--resize-${resize}`, className ?? null]
    .filter((token): token is string => Boolean(token))
    .join(' ');

  return <textarea rows={rows} className={classes} {...rest} />;
};
