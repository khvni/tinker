import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx.js';
import './Textarea.css';

export type TextareaResize = 'none' | 'vertical';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  resize?: TextareaResize;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, resize = 'vertical', rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx('tk-textarea', `tk-textarea--resize-${resize}`, className)}
      {...rest}
    />
  );
});
