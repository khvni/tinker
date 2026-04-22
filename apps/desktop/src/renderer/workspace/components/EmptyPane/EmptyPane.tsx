import type { JSX } from 'react';
import './EmptyPane.css';

export type EmptyPaneProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
};

export const EmptyPane = ({ eyebrow, title, description }: EmptyPaneProps): JSX.Element => {
  return (
    <section className="tinker-pane tinker-empty-pane">
      <div className="tinker-empty-pane__card" role="status" aria-live="polite">
        <p className="tinker-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
};
